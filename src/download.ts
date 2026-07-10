import { createWriteStream } from "node:fs";
import path from "node:path";
import ora from "ora";

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
};

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

/**
 * Download a generated asset into the current directory (or `outFile` if
 * given). Extension is taken from the URL, falling back to Content-Type.
 * Returns the absolute path of the saved file.
 */
export async function downloadToCwd(
  url: string,
  baseName: string,
  outFile?: string,
): Promise<string> {
  const spinner = ora("Downloading…").start();
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    }

    let file = outFile;
    if (!file) {
      const contentType = res.headers.get("content-type")?.split(";")[0] ?? "";
      const urlExt = path.extname(new URL(url).pathname).slice(1).toLowerCase();
      const ext = urlExt || EXT_BY_TYPE[contentType] || "bin";
      file = `${baseName}.${ext}`;
    }

    const total = Number(res.headers.get("content-length")) || 0;
    let received = 0;
    const out = createWriteStream(file);

    for await (const chunk of res.body) {
      received += chunk.length;
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      }
      spinner.text = total
        ? `Downloading — ${mb(received)}/${mb(total)} MB`
        : `Downloading — ${mb(received)} MB`;
    }
    await new Promise<void>((resolve, reject) => {
      out.on("error", reject);
      out.end(resolve);
    });

    spinner.succeed(`Saved ${file}`);
    return path.resolve(file);
  } catch (err) {
    spinner.stop();
    throw err;
  }
}
