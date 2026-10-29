import { Option, type Command } from "commander";
import { CATALOG_CATEGORIES } from "../paths.js";
import { listModelsAction } from "./catalog.js";

export function registerModelsCommand(program: Command): void {
  program
    .command("models [model]")
    .description(
      "List available AI models (live from the catalog), or show one model's inputs",
    )
    .option(
      "--category <category>",
      `Filter: ${CATALOG_CATEGORIES.join(", ")}`,
    )
    .option("--json", "Output as JSON")
    // Kept so `unsora models --all` keeps working; the catalog lists everything.
    .addOption(new Option("--all", "Show all models (default)").hideHelp())
    .action(listModelsAction);
}
