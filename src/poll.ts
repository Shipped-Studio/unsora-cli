import ora from "ora";
import { UnsoraClient, type StatusData } from "./client.js";

const TERMINAL = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  label?: string;
}

export async function pollUntilDone(
  client: UnsoraClient,
  fetchStatus: (id: string) => Promise<StatusData>,
  id: string,
  options: PollOptions = {},
): Promise<StatusData> {
  const {
    intervalMs = 3000,
    timeoutMs = 600_000,
    label = "Processing",
  } = options;

  const spinner = ora(`${label}…`).start();
  const started = Date.now();

  try {
    while (true) {
      const data = await fetchStatus(id);
      spinner.text = `${label} — ${data.status}`;

      if (TERMINAL.has(data.status)) {
        if (data.status === "COMPLETED") {
          spinner.succeed(`${label} completed`);
        } else {
          spinner.fail(`${label} ${data.status.toLowerCase()}`);
          if (data.error) {
            throw new Error(data.error);
          }
        }
        return data;
      }

      if (Date.now() - started > timeoutMs) {
        spinner.fail(`${label} timed out`);
        throw new Error(`Timed out after ${timeoutMs / 1000}s (id: ${id})`);
      }

      await sleep(intervalMs);
    }
  } catch (err) {
    spinner.stop();
    throw err;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
