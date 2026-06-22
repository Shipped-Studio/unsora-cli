import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { exitWithError, formatTable, printJson } from "../output.js";

export function registerClipCommands(program: Command): void {
  const clip = program.command("clip").description("AI video clipping");

  clip
    .command("create")
    .description("Clip a long video into viral shorts")
    .requiredOption("-u, --url <url>", "Source video URL (YouTube, etc.)")
    .option("--limit <n>", "Max number of clips (1–20)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = { videoUrl: opts.url };
      if (opts.limit) body.limit = Number(opts.limit);

      try {
        const data = await client.createClip(body);
        if (opts.json) printJson(data);
        else {
          const job = (data as { data?: { id?: string } }).data;
          console.log(`Clipping job queued: ${job?.id ?? "(see --json)"}`);
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("list")
    .description("List clipping jobs")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listClips();
        if (opts.json) {
          printJson(data);
          return;
        }
        const jobs = (data as { data?: Array<Record<string, unknown>> }).data;
        if (!jobs?.length) {
          console.log("(no jobs)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "URL"],
          ...jobs.map((j) => [
            String(j.id ?? "").slice(0, 12),
            String(j.status ?? ""),
            String(j.videoUrl ?? "").slice(0, 40),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("get <id>")
    .description("Get a clipping job with clips")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getClip(id);
        if (opts.json) printJson(data);
        else console.log(JSON.stringify(data, null, 2));
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("status <id>")
    .description("Refresh clipping job status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getClipStatus(id);
        if (opts.json) printJson(data);
        else console.log(JSON.stringify(data, null, 2));
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("delete <id>")
    .description("Delete a clipping job")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteClip(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
