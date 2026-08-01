import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { PLATFORMS } from "../paths.js";
import { exitWithError, formatTable, printJson } from "../output.js";

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}

type AccountRow = {
  id?: string;
  provider?: string;
  accountName?: string;
  accountUsername?: string;
};

export function registerSocialCommands(program: Command): void {
  program
    .command("accounts")
    .description(
      `List connected social accounts (${PLATFORMS.join(", ")})`,
    )
    .option("--platform <name>", "Filter by platform/provider")
    .option("--json", "Output as JSON")
    .action(async (opts: { platform?: string; json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.getAccounts()) as { data?: AccountRow[] };
        let accounts = data.data ?? [];
        if (opts.platform) {
          // YouTube accounts are stored with provider "google".
          const wanted = opts.platform.toLowerCase();
          const match = wanted === "youtube" ? "google" : wanted;
          accounts = accounts.filter(
            (a) => (a.provider ?? "").toLowerCase() === match,
          );
        }
        if (opts.json) {
          printJson(accounts);
          return;
        }
        if (!accounts.length) {
          console.log(
            "(no connected accounts — connect them in the Unsora app)",
          );
          return;
        }
        formatTable([
          ["ID", "PLATFORM", "NAME", "USERNAME"],
          ...accounts.map((a) => [
            String(a.id ?? ""),
            String(a.provider ?? ""),
            String(a.accountName ?? ""),
            String(a.accountUsername ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  const post = program
    .command("post")
    .description(
      `Schedule social posts to connected accounts (${PLATFORMS.join(", ")})`,
    );

  post
    .command("create")
    .description("Create or schedule a post (requires paid plan)")
    .requiredOption("-c, --caption <text>", "Post caption")
    .requiredOption(
      "-a, --account <id>",
      "Account id (repeatable — see `unsora accounts`)",
      collect,
      [],
    )
    .option("--video <url>", "Video URL to post")
    .option("--image <url>", "Image URL for a slideshow (repeatable)", collect, [])
    .option("--title <text>", "Title (YouTube video / Pinterest pin)")
    .option(
      "--schedule <iso>",
      "ISO datetime to schedule (≥2 min ahead); omit to post now",
    )
    .option("--timezone <tz>", "IANA timezone for the schedule")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (opts.video && opts.image?.length) {
        exitWithError("Use either --video or --image, not both");
      }

      const client = new UnsoraClient();
      const accounts = (opts.account as string[]).map((id) => ({
        id,
        ...(opts.title ? { title: opts.title } : {}),
      }));
      const body: Record<string, unknown> = {
        caption: opts.caption,
        accounts,
      };
      if (opts.video) {
        body.media = { type: "video", url: opts.video };
      } else if (opts.image?.length) {
        body.media = { type: "slideshow", urls: opts.image };
      }
      if (opts.schedule) body.scheduled_at = opts.schedule;
      if (opts.timezone) body.timezone = opts.timezone;

      try {
        const data = await client.createPost(body);
        if (opts.json) printJson(data);
        else {
          const root = data as { data?: { id?: string; status?: string } };
          const id = root.data?.id ?? "(unknown id)";
          const status = root.data?.status ?? "created";
          console.log(`✓ Post ${id} — ${status}`);
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("list")
    .description("List posts")
    .option("--status <status>", "Filter: DRAFT, SCHEDULED, PUBLISHED, FAILED…")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.listPosts({
          status: opts.status,
          page: Number(opts.page),
        })) as {
          data?: { posts?: Array<Record<string, unknown>> };
        };
        if (opts.json) {
          printJson(data);
          return;
        }
        const posts = data.data?.posts;
        if (!posts?.length) {
          console.log("(no posts)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "SCHEDULED", "CAPTION"],
          ...posts.map((p) => [
            String(p.id ?? "").slice(0, 12),
            String(p.status ?? ""),
            p.scheduledFor ? String(p.scheduledFor) : "-",
            String(p.mainCaption ?? "").slice(0, 40),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("get <id>")
    .description("Show one post with per-account publish status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getPost(id);
        printJson(opts.json ? data : (data as { data?: unknown }).data ?? data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("update <id>")
    .description("Edit a draft/scheduled post (published posts can't be edited)")
    .option("-c, --caption <text>", "New caption")
    .option("--schedule <iso>", "New ISO schedule datetime")
    .option("--unschedule", "Convert back to a draft")
    .option("--timezone <tz>", "IANA timezone for the schedule")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts) => {
      if (opts.schedule && opts.unschedule) {
        exitWithError("Use either --schedule or --unschedule, not both");
      }
      const body: Record<string, unknown> = {};
      if (opts.caption) body.mainCaption = opts.caption;
      if (opts.schedule) body.scheduledFor = opts.schedule;
      if (opts.unschedule) body.scheduledFor = null;
      if (opts.timezone) body.timezone = opts.timezone;
      if (!Object.keys(body).length) {
        exitWithError("Nothing to update — pass --caption, --schedule, or --unschedule");
      }

      const client = new UnsoraClient();
      try {
        const data = await client.updatePost(id, body);
        if (opts.json) printJson(data);
        else console.log(`✓ Updated ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("retry <id>")
    .description(
      "Retry a FAILED or PARTIALLY_PUBLISHED post (only failed accounts re-attempt)",
    )
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.retryPost(id);
        if (opts.json) printJson(data);
        else {
          const root = data as { message?: string };
          console.log(root.message ?? `✓ Retried ${id}`);
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  post
    .command("delete <id>")
    .description("Delete a post (does not remove already-published content)")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deletePost(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
