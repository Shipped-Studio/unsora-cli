import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Command } from "commander";
import {
  clearConfig,
  getConfig,
  getConfigPath,
  setConfigKey,
} from "../config.js";
import { UnsoraClient } from "../client.js";
import { DEFAULT_BASE_URL } from "../paths.js";
import { exitWithError, printJson } from "../output.js";

export function registerAuthCommands(program: Command): void {
  const auth = program.command("auth").description("Manage API authentication");

  auth
    .command("login")
    .description("Save your Unsora API key locally")
    .option("--key <key>", "API key (uns_…)")
    .action(async (opts: { key?: string }) => {
      let key = opts.key ?? process.env.UNSORA_API_KEY;
      if (!key) {
        const rl = createInterface({ input, output });
        key = await rl.question(
          "Paste your API key (from app.tryunsora.com → Settings → API Keys): ",
        );
        rl.close();
      }
      key = key.trim();
      if (!key) exitWithError("API key is required");

      setConfigKey("apiKey", key);
      if (!getConfig().baseUrl) {
        setConfigKey("baseUrl", DEFAULT_BASE_URL);
      }

      const client = new UnsoraClient({ apiKey: key });
      try {
        const { credits } = await client.getCredits();
        console.log(`✓ Logged in. Credits: ${credits}`);
        console.log(`  Config: ${getConfigPath()}`);
      } catch (err) {
        exitWithError(
          err instanceof Error ? err.message : "Failed to verify API key",
        );
      }
    });

  auth
    .command("logout")
    .description("Remove saved API key")
    .action(() => {
      clearConfig();
      console.log("✓ Logged out");
    });

  auth
    .command("whoami")
    .description("Show account credits and subscription")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const [credits, subscription] = await Promise.all([
          client.getCredits(),
          client.getSubscription(),
        ]);
        if (opts.json) {
          printJson({ credits, subscription });
          return;
        }
        console.log(`Credits: ${credits.credits}`);
        console.log(`Subscription:`, subscription);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Auth failed");
      }
    });
}

export function registerConfigCommands(program: Command): void {
  const config = program
    .command("config")
    .description("Manage CLI configuration");

  config
    .command("set")
    .description("Set a config value")
    .argument("<key>", "apiKey | baseUrl")
    .argument("<value>", "value")
    .action((key: string, value: string) => {
      if (key !== "apiKey" && key !== "baseUrl") {
        exitWithError('Key must be "apiKey" or "baseUrl"');
      }
      setConfigKey(key, value);
      console.log(`✓ Set ${key}`);
    });

  config
    .command("get")
    .description("Show current config (API key masked)")
    .action(() => {
      const cfg = getConfig();
      const masked = cfg.apiKey
        ? `${cfg.apiKey.slice(0, 12)}…${cfg.apiKey.slice(-4)}`
        : "(not set)";
      console.log(`apiKey:  ${masked}`);
      console.log(`baseUrl: ${cfg.baseUrl ?? DEFAULT_BASE_URL}`);
      console.log(`file:    ${getConfigPath()}`);
    });
}
