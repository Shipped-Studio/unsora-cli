import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { MUSIC_MODELS } from "../paths.js";
import { exitWithError, formatTable, printJson } from "../output.js";

export function registerMusicCommands(program: Command): void {
  const music = program.command("music").description("Music generation (Mureka)");

  music
    .command("create")
    .description("Create a music generation")
    .option("-p, --prompt <text>", "Style prompt")
    .option("-l, --lyrics <text>", "Song lyrics (required for song models)")
    .option(
      "-m, --model <model>",
      `Model (${MUSIC_MODELS.join(", ")})`,
      "auto",
    )
    .option("--format <fmt>", "Output format: mp3 | wav | flac", "mp3")
    .option("--no-wait", "Return immediately without polling")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.prompt && !opts.lyrics) {
        exitWithError("Provide --prompt and/or --lyrics");
      }

      const client = new UnsoraClient();
      const body: Record<string, unknown> = {
        model: opts.model,
        output_format: opts.format,
      };
      if (opts.prompt) body.prompt = opts.prompt;
      if (opts.lyrics) body.lyrics = opts.lyrics;

      try {
        const created = (await client.createMusic(body)) as {
          generation?: { id: string };
        };
        const id = created.generation?.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.noWait) {
          if (opts.json) printJson(created);
          else console.log(`Queued: ${id}`);
          return;
        }

        const result = await pollUntilDone(
          client,
          (i) => client.getMusicStatus(i),
          id,
          { label: "Music", timeoutMs: 600_000 },
        );

        const out = { id, ...result };
        if (opts.json) printJson(out);
        else if (result.outputUrl) console.log(result.outputUrl);
        else console.log(id);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  music
    .command("list")
    .description("List music generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listMusic(Number(opts.page));
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
          ["ID", "STATUS", "MODEL"],
          ...gens.map((g) => [
            String(g.id ?? "").slice(0, 12),
            String(g.status ?? ""),
            String(g.model ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  music
    .command("status <id>")
    .description("Get music generation status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getMusicStatus(id);
        if (opts.json) printJson(data);
        else console.log(`${data.status}${data.outputUrl ? ` — ${data.outputUrl}` : ""}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  music
    .command("delete <id>")
    .description("Delete a music generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteMusic(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
