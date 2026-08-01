import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";

const STYLE_MODES = [
  "ugc",
  "casual_daylight",
  "cozy_indoor",
  "low_light_intimate",
  "raw_flash",
  "golden_hour",
  "moody_night",
  "car_selfie",
  "mirror_selfie",
  "luxury_influencer",
  "cinematic",
  "travel_content",
  "beauty_closeup",
  "party_night_out",
] as const;

const CAMERA_ANGLES = [
  "pov",
  "portrait",
  "full-body",
  "close-up",
  "side-profile",
] as const;

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

export function registerInfluencerCommands(program: Command): void {
  const influencer = program
    .command("influencer")
    .description("AI influencer portrait generation");

  influencer
    .command("create")
    .description("Create AI influencer portrait(s)")
    .requiredOption("-p, --prompt <text>", "Portrait prompt")
    .option("-r, --ratio <ratio>", "Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4")
    .option("-c, --count <n>", "Number of portraits (1–10)")
    .option("--angle <angle>", `Camera angle (${CAMERA_ANGLES.join(", ")})`)
    .option("--style <mode>", `Style mode (${STYLE_MODES.join(", ")})`)
    .option("--age <n>", "Subject age in years (18–70)")
    .option("--no-wait", "Return immediately without polling")
    .option("--no-save", "Don't download the result files")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = { prompt: opts.prompt };
      if (opts.ratio) body.aspectRatio = opts.ratio;
      if (opts.count) body.count = Number(opts.count);
      if (opts.angle) body.cameraAngle = opts.angle;
      if (opts.style) body.styleMode = opts.style;
      if (opts.age) body.age = Number(opts.age);

      try {
        const created = await client.createInfluencer(body);
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
            { label: `Influencer ${id.slice(0, 8)}` },
          );
          let savedTo: string | null = null;
          if (result.outputUrl && opts.save) {
            savedTo = await downloadToCwd(
              result.outputUrl,
              `unsora-influencer-${id}`,
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

  influencer
    .command("list")
    .description("List influencer generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listInfluencers(Number(opts.page));
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

  influencer
    .command("status <id>")
    .description("Get influencer generation status")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getImageStatus(id);
        if (opts.save && data.outputUrl) {
          await downloadToCwd(data.outputUrl, `unsora-influencer-${id}`);
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

  influencer
    .command("delete <id>")
    .description("Delete an influencer generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteInfluencer(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
