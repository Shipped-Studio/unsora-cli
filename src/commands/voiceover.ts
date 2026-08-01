import type { Command } from "commander";
import { UnsoraClient } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import { exitWithError, formatTable, printJson } from "../output.js";

export function registerVoiceoverCommands(program: Command): void {
  const voiceover = program
    .command("voiceover")
    .description("Script-to-speech voiceovers (ElevenLabs Eleven v3)");

  voiceover
    .command("voices")
    .description("List available voices with preview URLs")
    .option("--json", "Output as JSON")
    .action(async (opts: { json?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listVoiceoverVoices();
        if (opts.json) {
          printJson(data);
          return;
        }
        const voices = (data as { voices?: Array<Record<string, unknown>> })
          .voices;
        if (!voices?.length) {
          console.log("(no voices)");
          return;
        }
        formatTable([
          ["VOICE", "GENDER", "ACCENT", "DESCRIPTION"],
          ...voices.map((v) => [
            String(v.voice_id ?? v.name ?? ""),
            String(v.gender ?? ""),
            String(v.accent ?? ""),
            String(v.description ?? "").slice(0, 50),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  voiceover
    .command("create")
    .description("Create a voiceover (6 credits per started 1,000 characters)")
    .requiredOption("-t, --text <text>", "Script to voice (max 10,000 chars)")
    .requiredOption(
      "-v, --voice <voice>",
      "Voice id (see `unsora voiceover voices`)",
    )
    .option("--stability <n>", "0–1, higher = more consistent delivery")
    .option("--similarity <n>", "0–1, how closely to match the base voice")
    .option("--no-wait", "Return immediately without polling")
    .option("-o, --output <file>", "Save the result to this file path")
    .option("--no-save", "Don't download the result file")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      const body: Record<string, unknown> = {
        text: opts.text,
        voice_id: opts.voice,
      };
      if (opts.stability !== undefined) body.stability = Number(opts.stability);
      if (opts.similarity !== undefined) {
        body.similarity = Number(opts.similarity);
      }

      try {
        const created = (await client.createVoiceover(body)) as {
          generation?: { id: string };
        };
        const id = created.generation?.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.noWait) {
          if (opts.json) printJson(created);
          else console.log(`Queued: ${id}`);
          return;
        }

        const result = await pollUntilDone(
          client,
          (i) => client.getVoiceoverStatus(i),
          id,
          { label: "Voiceover", timeoutMs: 600_000 },
        );

        let savedTo: string | null = null;
        if (result.outputUrl && opts.save) {
          savedTo = await downloadToCwd(
            result.outputUrl,
            `unsora-voiceover-${id}`,
            opts.output,
          );
        }

        const out = { ...result, id, savedTo };
        if (opts.json) printJson(out);
        else if (result.outputUrl) console.log(result.outputUrl);
        else console.log(id);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  voiceover
    .command("list")
    .description("List voiceover generations")
    .option("--page <n>", "Page", "1")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = await client.listVoiceovers(Number(opts.page));
        if (opts.json) {
          printJson(data);
          return;
        }
        const gens = (data as { generations?: Array<Record<string, unknown>> })
          .generations;
        if (!gens?.length) {
          console.log("(no generations)");
          return;
        }
        formatTable([
          ["ID", "STATUS", "VOICE"],
          ...gens.map((g) => [
            String(g.id ?? "").slice(0, 12),
            String(g.status ?? ""),
            String(g.voiceId ?? g.voice_id ?? ""),
          ]),
        ]);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  voiceover
    .command("status <id>")
    .description("Get voiceover generation status")
    .option("--save", "Download the result to the current directory")
    .option("--json", "Output as JSON")
    .action(async (id: string, opts: { json?: boolean; save?: boolean }) => {
      const client = new UnsoraClient();
      try {
        const data = await client.getVoiceoverStatus(id);
        if (opts.save && data.outputUrl) {
          await downloadToCwd(data.outputUrl, `unsora-voiceover-${id}`);
        }
        if (opts.json) printJson(data);
        else {
          console.log(
            `${data.status}${data.outputUrl ? ` — ${data.outputUrl}` : ""}`,
          );
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  voiceover
    .command("delete <id>")
    .description("Delete a voiceover generation")
    .action(async (id: string) => {
      const client = new UnsoraClient();
      try {
        await client.deleteVoiceover(id);
        console.log(`✓ Deleted ${id}`);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
