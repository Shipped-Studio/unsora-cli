import { Option, type Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import { collect, IDEMPOTENCY_HELP } from "../options.js";

export function registerVideoCommands(program: Command): void {
  const video = program
    .command("video")
    .description("Video generation (Seedance, Veo, Kling, Sora, Wan, …)");

  video
    .command("create")
    .description(
      "Create a video (any video model from `unsora models --category video`)",
    )
    .requiredOption("-p, --prompt <text>", "Generation prompt")
    .option(
      "-m, --model <model>",
      "Video model key, e.g. seedance-2.0, veo-3.1-fast, kling-o3-pro",
      "seedance-2.0",
    )
    .option("-r, --ratio <ratio>", "Aspect ratio (valid values depend on the model)", "16:9")
    .option("-d, --duration <seconds>", "Duration in seconds", "5")
    .option("--resolution <res>", "Output resolution, e.g. 720p or 1080p (model-dependent)")
    .option("--sound", "Generate audio (models that offer it)")
    .option("--no-sound", "Generate without audio")
    .option("--negative-prompt <text>", "What to avoid (not supported by Sora or Seedance)")
    .option("--start-image <url>", "Start frame image URL (image-to-video)")
    .option("--last-image <url>", "End frame image URL (start/end-frame models)")
    .option("--ref <url>", "Reference image URL (repeatable)", collect, [])
    .option("--ref-video <url>", "Reference video URL (Seedance omni reference, repeatable, up to 3)", collect, [])
    .option("--ref-audio <url>", "Reference audio URL (Seedance omni reference, repeatable, up to 3)", collect, [])
    .addOption(
      new Option("--image <url>", "Alias of --ref (deprecated)")
        .argParser(collect)
        .default([])
        .hideHelp(),
    )
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
        aspectRatio: opts.ratio,
        duration: Number(opts.duration),
      };
      if (opts.resolution) body.resolution = opts.resolution;
      if (typeof opts.sound === "boolean") body.sound = opts.sound;
      if (opts.negativePrompt) body.negativePrompt = opts.negativePrompt;
      if (opts.startImage) body.image = opts.startImage;
      if (opts.lastImage) body.lastImage = opts.lastImage;
      const refs = [...(opts.ref ?? []), ...(opts.image ?? [])];
      if (refs.length) body.referenceImages = refs;
      if (opts.refVideo?.length) body.referenceVideos = opts.refVideo;
      if (opts.refAudio?.length) body.referenceAudios = opts.refAudio;

      try {
        const created = (await client.createVideo(body, {
          idempotencyKey: opts.idempotencyKey,
        })) as {
          generation?: { id: string };
          id?: string;
        };
        const id = created.generation?.id ?? created.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.wait === false) {
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

        let savedTo: string | null = null;
        if (result.outputUrl && opts.save) {
          savedTo = await downloadToCwd(
            result.outputUrl,
            `unsora-video-${id}`,
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

  video
    .command("list")
    .description("List video generations")
    .option("--page <n>", "Page", "1")
    .option("-m, --model <model>", "Filter by video model key")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listVideos(Number(opts.page), 12, opts.model);
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

  video
    .command("status <id>")
    .description("Get video generation status")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getVideoStatus(id);
        if (opts.save && data.outputUrl) {
          await downloadToCwd(data.outputUrl, `unsora-video-${id}`);
        }
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
