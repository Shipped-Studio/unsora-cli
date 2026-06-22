import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { IMAGE_MODELS } from "../paths.js";
import { exitWithError, formatTable, printJson } from "../output.js";

export function registerImageCommands(program: Command): void {
  const image = program.command("image").description("Image generation");

  image
    .command("create")
    .description("Create an image generation")
    .requiredOption("-p, --prompt <text>", "Generation prompt")
    .option(
      "-m, --model <model>",
      `Model (${IMAGE_MODELS.join(", ")})`,
      "nano-banana-2",
    )
    .option("-r, --ratio <ratio>", "Aspect ratio, e.g. 16:9")
    .option("--resolution <res>", "Resolution")
    .option("--ref <url>", "Reference image URL (repeatable)", collect, [])
    .option("--no-wait", "Return immediately without polling")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = {
        prompt: opts.prompt,
        model: opts.model,
      };
      if (opts.ratio) body.ratio = opts.ratio;
      if (opts.resolution) body.resolution = opts.resolution;
      if (opts.ref?.length) body.referenceImageUrls = opts.ref;

      try {
        const created = (await client.createImage(body)) as {
          generation: { id: string };
        };
        const id = created.generation.id;

        if (opts.noWait) {
          if (opts.json) printJson(created);
          else console.log(`Queued: ${id}`);
          return;
        }

        const result = await pollUntilDone(
          client,
          (i) => client.getImageStatus(i),
          id,
          { label: "Image" },
        );

        const out = { id, ...result };
        if (opts.json) printJson(out);
        else if (result.outputUrl) console.log(result.outputUrl);
        else console.log(id);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  image
    .command("list")
    .description("List image generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listImages(Number(opts.page));
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
          ["ID", "STATUS", "MODEL", "PROMPT"],
          ...gens.map((g) => [
            String(g.id ?? "").slice(0, 12),
            String(g.status ?? ""),
            String(g.model ?? ""),
            String(g.prompt ?? "").slice(0, 40),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  image
    .command("status <id>")
    .description("Get image generation status")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getImageStatus(id);
        if (opts.json) printJson(data);
        else console.log(`${data.status}${data.outputUrl ? ` — ${data.outputUrl}` : ""}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  image
    .command("delete <id>")
    .description("Delete an image generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteImage(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}

function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}
