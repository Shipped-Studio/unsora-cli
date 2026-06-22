import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { exitWithError, printJson } from "../output.js";

export function registerCreditsCommands(program: Command): void {
  program
    .command("credits")
    .description("Show your credit balance")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getCredits();
        if (opts.json) {
          printJson(data);
          return;
        }
        console.log(`Credits: ${data.credits}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
