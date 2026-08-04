import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { exitWithError, formatTable, printJson } from "../output.js";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".pdf": "application/pdf",
};

type UploadedAsset = {
  id?: string;
  url?: string;
  mimeType?: string;
  fileSize?: number | null;
};

export function registerUploadCommands(program: Command): void {
  const upload = program
    .command("upload")
    .description("Upload media to your Unsora library");

  upload
    .command("create <fileOrUrl>", { isDefault: true })
    .description("Upload a local file or import a public URL")
    .option("--name <fileName>", "Override the stored file name")
    .option("--type <mime>", "Override the content type, e.g. image/png")
    .option("--json", "Output as JSON")
    .action(async (fileOrUrl: string, opts) => {
      const client = new UnsoraClient();
      try {
        let data: { data?: UploadedAsset };

        if (/^https?:\/\//i.test(fileOrUrl)) {
          data = (await client.uploadFromUrl({
            url: fileOrUrl,
            ...(opts.name ? { fileName: opts.name } : {}),
            ...(opts.type ? { contentType: opts.type } : {}),
          })) as { data?: UploadedAsset };
        } else {
          const info = await stat(fileOrUrl).catch(() => null);
          if (!info?.isFile()) {
            exitWithError(`File not found: ${fileOrUrl}`);
          }
          const fileName = opts.name || basename(fileOrUrl);
          const contentType =
            opts.type ||
            MIME_BY_EXT[extname(fileOrUrl).toLowerCase()] ||
            "application/octet-stream";

          // Large-file path: signed direct upload, then register the asset.
          const signed = (await client.createUploadSignedUrl(fileName)) as {
            data?: { uploadUrl?: string; blobName?: string };
          };
          const uploadUrl = signed.data?.uploadUrl;
          const blobName = signed.data?.blobName;
          if (!uploadUrl || !blobName) {
            exitWithError("No upload URL in response");
          }

          const bytes = await readFile(fileOrUrl);
          const put = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: new Uint8Array(bytes),
          });
          if (!put.ok) {
            exitWithError(`Upload failed: HTTP ${put.status}`);
          }

          data = (await client.completeUpload(blobName, fileName)) as {
            data?: UploadedAsset;
          };
        }

        if (opts.json) printJson(data);
        else if (data.data?.url) console.log(data.data.url);
        else printJson(data);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  upload
    .command("list")
    .description("List your uploaded media")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.listUploads(Number(opts.page))) as {
          data?: { uploads?: Array<Record<string, unknown>> };
        };
        if (opts.json) {
          printJson(data);
          return;
        }
        const uploads = data.data?.uploads;
        if (!uploads?.length) {
          console.log("(no uploads)");
          return;
        }
        formatTable([
          ["ID", "TYPE", "NAME", "URL"],
          ...uploads.map((u) => [
            String(u.id ?? "").slice(0, 12),
            String(u.type ?? ""),
            String(u.name ?? "").slice(0, 30),
            String(u.url ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  upload
    .command("delete <id>")
    .description("Delete an uploaded asset (also removes the stored file)")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteUpload(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
