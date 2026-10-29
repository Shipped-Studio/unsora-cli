import type { Command } from "commander";
import { UnsoraClient, type StatusData } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import { IDEMPOTENCY_HELP } from "../options.js";

const TARGET_DURATIONS = ["auto", "lt30", "30-60", "60-90", "90-3min", "gt3min"];
const RATIOS = ["9:16", "1:1", "4:5", "16:9", "original"];

type ClipJob = Record<string, unknown> & {
  id?: string;
  status?: string;
  error?: string | null;
  clips?: Array<Record<string, unknown>>;
};

function clipUrl(c: Record<string, unknown>): string {
  const asset = c.outputAsset as { url?: string } | null | undefined;
  return String(asset?.url ?? c.url ?? c.videoUrl ?? "");
}

function printJob(job: ClipJob): void {
  console.log(`Job:    ${job.id ?? ""}`);
  console.log(`Status: ${job.status ?? ""}`);
  if (job.error) console.log(`Error:  ${job.error}`);
  const clips = job.clips ?? [];
  if (!clips.length) {
    console.log("(no clips yet)");
    return;
  }
  console.log("");
  formatTable([
    ["CLIP ID", "STATUS", "DURATION", "TITLE", "URL"],
    ...clips.map((c) => [
      String(c.id ?? ""),
      String(c.status ?? ""),
      typeof c.duration === "number" ? `${Math.round(c.duration)}s` : "-",
      String(c.title ?? "").slice(0, 40),
      clipUrl(c),
    ]),
  ]);
}

export function registerClipCommands(program: Command): void {
  const clip = program.command("clip").description("AI video clipping");

  clip
    .command("create")
    .description(
      "Clip a long video into viral shorts (credits depend on the source length)",
    )
    .requiredOption("-u, --url <url>", "Source video URL (YouTube, uploaded file, etc.)")
    .option("--limit <n>", "Max number of clips (1–20)")
    .option(
      "-d, --duration <range>",
      `Clip length: ${TARGET_DURATIONS.join(", ")} (default auto, up to 90s)`,
    )
    .option("-r, --ratio <ratio>", `Output ratio: ${RATIOS.join(", ")} (default original)`)
    .option("-q, --query <text>", "Describe the moments to find, e.g. \"funny reactions\"")
    .option("--captions", "Burn in captions")
    .option(
      "--caption-style <preset>",
      "Caption preset (with --captions), e.g. classic-yellow, bold-white, glow-pink, gaming-cyan",
    )
    .option("--source-lang <lang>", "Language spoken in the video")
    .option("--target-lang <lang>", "Language for the captions")
    .option("--idempotency-key <key>", IDEMPOTENCY_HELP)
    .option("--wait", "Poll until the job finishes and list the clips")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = { videoUrl: opts.url };
      if (opts.limit) body.limit = Number(opts.limit);
      if (opts.duration) body.targetDuration = opts.duration;
      if (opts.ratio) body.ratio = opts.ratio;
      if (opts.query) body.query = opts.query;
      if (opts.captions || opts.captionStyle) body.enableCaption = true;
      if (opts.captionStyle) body.captionStyle = opts.captionStyle;
      if (opts.sourceLang) body.sourceLang = opts.sourceLang;
      if (opts.targetLang) body.targetLang = opts.targetLang;

      try {
        const data = await client.createClip(body, {
          idempotencyKey: opts.idempotencyKey,
        });
        const job = (data as { data?: { id?: string } }).data;

        if (!opts.wait || !job?.id) {
          if (opts.json) printJson(data);
          else console.log(`Clipping job queued: ${job?.id ?? "(see --json)"}`);
          return;
        }

        let latest: ClipJob = {};
        await pollUntilDone(
          client,
          async (i) => {
            const res = (await client.getClipStatus(i)) as { data?: ClipJob };
            latest = res.data ?? {};
            return {
              id: i,
              status: String(latest.status ?? ""),
              error: latest.error ?? null,
            } satisfies StatusData;
          },
          job.id,
          { label: "Clipping", intervalMs: 10_000, timeoutMs: 3_600_000 },
        );

        if (opts.json) printJson(latest);
        else printJob(latest);
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
          ["ID", "STATUS", "CLIPS", "URL"],
          ...jobs.map((j) => [
            String(j.id ?? ""),
            String(j.status ?? ""),
            Array.isArray(j.clips) ? String(j.clips.length) : "-",
            String(j.videoUrl ?? "").slice(0, 40),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("get <id>")
    .description("Get a clipping job with its clips (no provider sync)")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getClip(id);
        if (opts.json) printJson(data);
        else printJob((data as { data?: ClipJob }).data ?? {});
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  clip
    .command("status <id>")
    .description("Refresh clipping job status (syncs with the provider)")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getClipStatus(id);
        if (opts.json) printJson(data);
        else printJob((data as { data?: ClipJob }).data ?? {});
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

  clip
    .command("delete-clip <id> <clipId>")
    .description("Delete one clip from a clipping job (see `unsora clip get <id>`)")
    .action(async (id: string, clipId: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteClipItem(id, clipId);
        console.log(`✓ Deleted clip ${clipId} from ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
