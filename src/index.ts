import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { Command } from "commander";
import updateNotifier from "update-notifier";
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

const pkg = createRequire(import.meta.url)("../package.json") as {
  name: string;
  version: string;
};

const LOGO = `
 _   _ _   _ ____   ___  ____      _
| | | | \\ | / ___| / _ \\|  _ \\    / \\
| | | |  \\| \\___ \\| | | | |_) |  / _ \\
| |_| | |\\  |___) | |_| |  _ <  / ___ \\
 \\___/|_| \\_|____/ \\___/|_| \\_\\/_/   \\_\\
`;

function logo(): string {
  const art = process.stdout.isTTY ? `\x1b[36m${LOGO}\x1b[0m` : LOGO;
  return `${art}\n  AI video, image, music & clipping — ${WEBSITE_URL}\n`;
}

const notifier = updateNotifier({ pkg });
if (notifier.update) {
  notifier.notify({
    message: `Update available ${notifier.update.current} → ${notifier.update.latest}\nRun \`unsora upgrade\` to update`,
  });
}

const program = new Command();

program
  .name("unsora")
  .description("Unsora CLI — AI video, image, music, and clipping")
  .version(pkg.version)
  .addHelpText("before", logo());

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

program
  .command("upgrade")
  .description("Update unsora-cli to the latest version")
  .action(() => {
    console.log(`Current version: ${pkg.version}`);
    console.log("Installing unsora-cli@latest…\n");
    const result = spawnSync("npm", ["install", "-g", "unsora-cli@latest"], {
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    process.exit(result.status ?? 0);
  });

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
