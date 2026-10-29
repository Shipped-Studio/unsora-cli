import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import { collect, IDEMPOTENCY_HELP } from "../options.js";

const EXPRESSIONS = [
  "auto",
  "neutral",
  "soft-smile",
  "big-smile",
  "surprised",
  "confused",
  "worried",
  "angry",
  "sad",
  "disgusted",
  "determined",
] as const;

const YOUTUBE_URL = /^https?:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\//i;

function extractIds(payload: unknown): string[] {
  const root = (payload ?? {}) as Record<string, unknown>;
  const gens = root.generations;
  if (Array.isArray(gens)) {
    return gens
      .map((g) => (g as Record<string, unknown> | null)?.id)
      .filter((id): id is string => typeof id === "string");
  }
  const gen = root.generation as Record<string, unknown> | undefined;
  return typeof gen?.id === "string" ? [gen.id] : [];
}

export function registerThumbnailCommands(program: Command): void {
  const thumbnail = program
    .command("thumbnail")
    .description("YouTube-style thumbnail generation (16:9)");

  thumbnail
    .command("create")
    .description(
      "Create thumbnail variations (one job and 12 credits per variation)",
    )
    .option("-p, --prompt <text>", "Title or idea for the thumbnail")
    .option("--ref <url>", "Reference image URL, e.g. the creator's face (repeatable, up to 16)", collect, [])
    .option("--template <url>", "Layout template image URL (max 1)")
    .option(
      "--context <url>",
      "Source to read: a YouTube video URL (title + transcript) or a public PDF URL",
    )
    .option(
      "--context-type <type>",
      "Context type: youtube | document (default: detected from the URL)",
    )
    .option("--expression <name>", `Facial expression (${EXPRESSIONS.join(", ")})`)
    .option("--variations <n>", "Number of variations (1–20)")
    .option("--idempotency-key <key>", IDEMPOTENCY_HELP)
    .option("--no-wait", "Return immediately without polling")
    .option("--no-save", "Don't download the result files")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.prompt && !opts.ref?.length && !opts.template && !opts.context) {
        exitWithError("Provide --prompt, --context, --ref, or --template");
      }

      const client = new UnsoraClient();
      const body: Record<string, unknown> = {};
      if (opts.prompt) body.prompt = opts.prompt;
      if (opts.ref?.length) body.referenceImageUrls = opts.ref;
      if (opts.template) body.templateImageUrls = [opts.template];
      if (opts.context) {
        const type =
          opts.contextType ??
          (YOUTUBE_URL.test(opts.context) ? "youtube" : "document");
        if (type !== "youtube" && type !== "document") {
          exitWithError("--context-type must be youtube or document");
        }
        body.context = [{ type, content: opts.context }];
      }
      if (opts.expression) body.expression = opts.expression;
      if (opts.variations) body.variations = Number(opts.variations);

      try {
        const created = await client.createThumbnail(body, {
          idempotencyKey: opts.idempotencyKey,
        });
        const ids = extractIds(created);
        if (!ids.length) exitWithError("No generation ids in response");

        if (opts.wait === false) {
          if (opts.json) printJson(created);
          else ids.forEach((id) => console.log(`Queued: ${id}`));
          return;
        }

        const results: Array<Record<string, unknown>> = [];
        for (const id of ids) {
          const result = await pollUntilDone(
            client,
            (i) => client.getImageStatus(i),
            id,
            { label: `Thumbnail ${id.slice(0, 8)}` },
          );
          let savedTo: string | null = null;
          if (result.outputUrl && opts.save) {
            savedTo = await downloadToCwd(
              result.outputUrl,
              `unsora-thumbnail-${id}`,
            );
          }
          results.push({ ...result, id, savedTo });
        }

        if (opts.json) printJson(results);
        else {
          for (const r of results) {
            console.log(String(r.outputUrl ?? r.id));
          }
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  thumbnail
    .command("list")
    .description("List thumbnail generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listThumbnails(Number(opts.page));
        if (opts.json) {
          printJson(data);
          return;
        }
        // GET /thumbnails returns `data`; older servers returned `generations`.
        const root = data as {
          data?: Array<Record<string, unknown>>;
          generations?: Array<Record<string, unknown>>;
        };
        const gens = root.data ?? root.generations;
        if (!gens?.length) {
          console.log("(no generations)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "TITLE", "IMAGE"],
          ...gens.map((g) => [
            String(g.id ?? "").slice(0, 12),
            String(g.status ?? ""),
            String(g.title ?? g.prompt ?? "").slice(0, 40),
            String(g.image ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  thumbnail
    .command("get <id>")
    .description("Show one thumbnail generation")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.getThumbnail(id)) as {
          data?: Record<string, unknown> & { image?: string };
        };
        if (opts.save && data.data?.image) {
          await downloadToCwd(data.data.image, `unsora-thumbnail-${id}`);
        }
        if (opts.json) printJson(data);
        else printJson(data.data ?? data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  thumbnail
    .command("status <id>")
    .description("Get thumbnail generation status")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getImageStatus(id);
        if (opts.save && data.outputUrl) {
          await downloadToCwd(data.outputUrl, `unsora-thumbnail-${id}`);
        }
        if (opts.json) printJson(data);
        else {
          console.log(
            `${data.status}${data.outputUrl ? ` — ${data.outputUrl}` : ""}`,
          );
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  thumbnail
    .command("delete <id>")
    .description("Delete a thumbnail generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteThumbnail(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
