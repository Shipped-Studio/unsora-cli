import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}

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
    .description("Create thumbnail variations (one job per variation)")
    .option("-p, --prompt <text>", "Thumbnail prompt")
    .option("--ref <url>", "Reference image URL (repeatable)", collect, [])
    .option("--template <url>", "Template image URL (max 1)")
    .option("--context <text>", "Context line (repeatable)", collect, [])
    .option("--expression <text>", "Subject expression")
    .option("--variations <n>", "Number of variations (1–10)")
    .option("--no-wait", "Return immediately without polling")
    .option("--no-save", "Don't download the result files")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      if (!opts.prompt && !opts.ref?.length && !opts.template) {
        exitWithError("Provide --prompt, --ref, or --template");
      }

      const client = new UnsoraClient();
      const body: Record<string, unknown> = {};
      if (opts.prompt) body.prompt = opts.prompt;
      if (opts.ref?.length) body.referenceImageUrls = opts.ref;
      if (opts.template) body.templateImageUrls = [opts.template];
      if (opts.context?.length) body.context = opts.context;
      if (opts.expression) body.expression = opts.expression;
      if (opts.variations) body.variations = Number(opts.variations);

      try {
        const created = await client.createThumbnail(body);
        const ids = extractIds(created);
        if (!ids.length) exitWithError("No generation ids in response");

        if (opts.noWait) {
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
