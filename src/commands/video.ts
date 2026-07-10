import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { exitWithError, formatTable, printJson } from "../output.js";

export function registerVideoCommands(program: Command): void {
  const video = program.command("video").description("Video generation (Seedance 2.0)");

  video
    .command("create")
    .description("Create a Seedance 2.0 video")
    .requiredOption("-p, --prompt <text>", "Generation prompt")
    .option("-r, --ratio <ratio>", "Aspect ratio", "16:9")
    .option("-d, --duration <seconds>", "Duration in seconds", "5")
    .option("--image <url>", "Reference image URL (repeatable)", collect, [])
    .option("--no-wait", "Return immediately without polling")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = {
        prompt: opts.prompt,
        ratio: opts.ratio,
        duration: Number(opts.duration),
      };
      if (opts.image?.length) body.image_files = opts.image;

      try {
        const created = (await client.createVideo(body)) as {
          generation?: { id: string };
          id?: string;
        };
        const id = created.generation?.id ?? created.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.noWait) {
          if (opts.json) printJson(created);
          else console.log(`Queued: ${id}`);
          return;
        }

        const result = await pollUntilDone(
          client,
          (i) => client.getVideoStatus(i),
          id,
          { label: "Video", timeoutMs: 900_000 },
        );

        const out = { id, ...result };
        if (opts.json) printJson(out);
        else if (result.outputUrl) console.log(result.outputUrl);
        else console.log(id);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  video
    .command("list")
    .description("List video generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listVideos(Number(opts.page));
        if (opts.json) {
          printJson(data);
          return;
        }
        const gens = (data as { generations?: Array<Record<string, unknown>> })
          .generations;
        if (!gens?.length) {
          console.log("(no generations)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "PROMPT"],
          ...gens.map((g) => [
            String(g.id ?? "").slice(0, 12),
            String(g.status ?? ""),
            String(g.prompt ?? "").slice(0, 50),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  video
    .command("status <id>")
    .description("Get video generation status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getVideoStatus(id);
        if (opts.json) printJson(data);
        else console.log(`${data.status}${data.outputUrl ? ` — ${data.outputUrl}` : ""}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  video
    .command("delete <id>")
    .description("Delete a video generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteVideo(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}
