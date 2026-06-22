import type { Command } from "commander";
import {
  ALL_WAVESPEED_MODELS,
  APP_URL,
  API_DOCS_URL,
  DOCS_URL,
  IMAGE_MODELS,
  MUSIC_MODELS,
} from "../paths.js";
import { formatTable } from "../output.js";

export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("List available AI models")
    .option("--all", "Show all Wavespeed models (including web-app-only)")
    .action((opts: { all?: boolean }) => {
      console.log("Unsora CLI — public API models\n");

      console.log("Image (CLI + API):");
      for (const m of IMAGE_MODELS) console.log(`  • ${m}`);

      console.log("\nVideo (CLI + API):");
      console.log("  • seedance-2.0 (Seedance 2.0 via public API)");

      console.log("\nMusic (CLI + API):");
      for (const m of MUSIC_MODELS) console.log(`  • ${m}`);

      if (opts.all) {
        console.log("\n── All Wavespeed models (web app) ──");
        console.log(`Try them at ${APP_URL}\n`);
        formatTable([
          ["Category", "Models"],
          ["Video", ALL_WAVESPEED_MODELS.video.join(", ")],
          ["Image", ALL_WAVESPEED_MODELS.image.join(", ")],
          ["Motion", ALL_WAVESPEED_MODELS.motionControl.join(", ")],
          ["Music", ALL_WAVESPEED_MODELS.music.join(", ")],
        ]);
      } else {
        console.log(
          `\nFor Kling, Veo, Sora, Wan, and more → ${APP_URL}`,
        );
        console.log(`Run \`unsora models --all\` for the full list.`);
      }

      console.log(`\nDocs: ${DOCS_URL}`);
      console.log(`API:  ${API_DOCS_URL}`);
    });
}
