import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import { collect, IDEMPOTENCY_HELP } from "../options.js";

export function registerImageCommands(program: Command): void {
  const image = program.command("image").description("Image generation");

  image
    .command("create")
    .description(
      "Create an image (any image model from `unsora models --category image`)",
    )
    .requiredOption("-p, --prompt <text>", "Generation prompt")
    .option(
      "-m, --model <model>",
      "Image model key, e.g. nano-banana-2, nano-banana-pro, gpt-image-2, seedream-5.0-pro",
      "nano-banana-2",
    )
    .option("-r, --ratio <ratio>", "Aspect ratio, e.g. 16:9 (model-dependent; auto = model default)")
    .option("--resolution <res>", "Output size: 1k, 2k or 4k (models that offer it)")
    .option("--quality <tier>", "Quality tier (models that offer it)")
    .option("--ref <url>", "Reference image URL (repeatable; max depends on the model)", collect, [])
    .option("--idempotency-key <key>", IDEMPOTENCY_HELP)
    .option("--no-wait", "Return immediately without polling")
    .option("-o, --output <file>", "Save the result to this file path")
    .option("--no-save", "Don't download the result file")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = {
        prompt: opts.prompt,
        model: opts.model,
      };
      if (opts.ratio) body.aspectRatio = opts.ratio;
      if (opts.resolution) body.resolution = opts.resolution;
      if (opts.quality) body.quality = opts.quality;
      if (opts.ref?.length) body.referenceImages = opts.ref;

      try {
        const created = (await client.createImage(body, {
          idempotencyKey: opts.idempotencyKey,
        })) as {
          generation?: { id: string };
        };
        const id = created.generation?.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.wait === false) {
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

        let savedTo: string | null = null;
        if (result.outputUrl && opts.save) {
          savedTo = await downloadToCwd(
            result.outputUrl,
            `unsora-image-${id}`,
            opts.output,
          );
        }

        const out = { ...result, id, savedTo };
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
    .command("get <id>")
    .description("Show one image generation (prompt, model, output asset)")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.getImage(id)) as {
          generation?: Record<string, unknown> & {
            outputAsset?: { url?: string } | null;
          };
        };
        const gen = data.generation;
        const url = gen?.outputAsset?.url;
        if (opts.save && url) {
          await downloadToCwd(url, `unsora-image-${id}`);
        }
        if (opts.json) printJson(data);
        else printJson(gen ?? data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  image
    .command("status <id>")
    .description("Get image generation status")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getImageStatus(id);
        if (opts.save && data.outputUrl) {
          await downloadToCwd(data.outputUrl, `unsora-image-${id}`);
        }
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
