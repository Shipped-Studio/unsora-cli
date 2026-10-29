import ora from "ora";
import { UnsoraClient, type StatusData } from "./client.js";

const TERMINAL = ["COMPLETED", "FAILED", "CANCELLED"];
const SUCCESS = ["COMPLETED"];

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  label?: string;
  /** Statuses that stop polling (default: COMPLETED, FAILED, CANCELLED). */
  terminal?: string[];
  /** Terminal statuses that count as success (default: COMPLETED). */
  success?: string[];
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
    terminal = TERMINAL,
    success = SUCCESS,
  } = options;

  const spinner = ora(`${label}…`).start();
  const started = Date.now();
  let lastStatus = "";
  const ticker = setInterval(() => {
    const elapsed = Math.floor((Date.now() - started) / 1000);
    spinner.text = `${label}${lastStatus ? ` — ${lastStatus}` : ""} (${elapsed}s)`;
  }, 1000);

  try {
    while (true) {
      const data = await fetchStatus(id);
      lastStatus = data.status;
      spinner.text = `${label} — ${data.status}`;

      if (terminal.includes(data.status)) {
        const word = data.status.toLowerCase().replace(/_/g, " ");
        if (success.includes(data.status)) {
          spinner.succeed(`${label} ${word}`);
        } else {
          spinner.fail(`${label} ${word}`);
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
  } finally {
    clearInterval(ticker);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
