import { Command } from "commander";
import {
  registerAuthCommands,
  registerConfigCommands,
} from "./commands/auth.js";
import { registerCreditsCommands } from "./commands/credits.js";
import { registerImageCommands } from "./commands/image.js";
import { registerVideoCommands } from "./commands/video.js";
import { registerMusicCommands } from "./commands/music.js";
import { registerClipCommands } from "./commands/clip.js";
import { registerModelsCommand } from "./commands/models.js";
import { APP_URL, DOCS_URL, WEBSITE_URL, MCP_URL } from "./paths.js";

const program = new Command();

program
  .name("unsora")
  .description("Unsora CLI — AI video, image, music, and clipping")
  .version("0.1.0");

registerAuthCommands(program);
registerConfigCommands(program);
registerCreditsCommands(program);
registerImageCommands(program);
registerVideoCommands(program);
registerMusicCommands(program);
registerClipCommands(program);
registerModelsCommand(program);

program
  .command("open")
  .description("Print links to try Unsora")
  .action(() => {
    console.log("Try Unsora:");
    console.log(`  App:       ${APP_URL}`);
    console.log(`  Website:   ${WEBSITE_URL}`);
    console.log(`  API docs:  ${DOCS_URL}`);
    console.log(`  MCP:       ${MCP_URL}`);
    console.log("\nGet an API key: App → Settings → API Keys");
  });

program.parse();
