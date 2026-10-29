import type { Command } from "commander";
import { UnsoraClient, type StatusData } from "../client.js";
import { pollUntilDone } from "../poll.js";
import { downloadToCwd } from "../download.js";
import {
  APP_URL,
  CATALOG_CATEGORIES,
  DOCS_URL,
  MUSIC_MODELS,
} from "../paths.js";
import { exitWithError, formatTable, printJson } from "../output.js";
import {
  collect,
  IDEMPOTENCY_HELP,
  parseJsonOption,
  parseKeyValues,
} from "../options.js";

type CatalogField = {
  key: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value?: string; label?: string }>;
  default?: string;
  media?: { kind?: string; max?: number };
};

type CatalogMode = {
  key: string;
  label?: string;
  endpoints?: Array<{ modelId?: string; when?: string[]; fields?: CatalogField[] }>;
};

export type CatalogModel = {
  key: string;
  label?: string;
  provider?: string;
  category?: string;
  description?: string;
  isNew?: boolean;
  legacyDbModels?: string[];
  modes?: CatalogMode[];
};

async function fetchModels(
  client: UnsoraClient,
  category?: string,
): Promise<{ raw: unknown; models: CatalogModel[] }> {
  const raw = await client.getCatalog(category);
  return { raw, models: (raw as { models?: CatalogModel[] }).models ?? [] };
}

function findModel(models: CatalogModel[], key: string): CatalogModel | undefined {
  const k = key.toLowerCase();
  return (
    models.find((m) => m.key.toLowerCase() === k) ??
    models.find((m) => m.legacyDbModels?.some((l) => l.toLowerCase() === k))
  );
}

function checkCategory(category?: string): void {
  if (category && !(CATALOG_CATEGORIES as readonly string[]).includes(category)) {
    exitWithError(`--category must be one of: ${CATALOG_CATEGORIES.join(", ")}`);
  }
}

function describeField(f: CatalogField): string {
  const bits: string[] = [f.type ?? ""];
  if (f.required) bits.push("required");
  if (f.media) {
    bits.push(`${f.media.kind ?? "file"} URL${(f.media.max ?? 1) > 1 ? `s, up to ${f.media.max}` : ""}`);
  }
  if (f.options?.length) {
    bits.push(f.options.map((o) => o.value).join("|"));
  }
  if (f.default !== undefined && f.default !== "") bits.push(`default ${f.default}`);
  return bits.filter(Boolean).join(" · ");
}

function printModelDetail(m: CatalogModel): void {
  console.log(`${m.label ?? m.key} (${m.key}) — ${m.category ?? ""}${m.provider ? `, ${m.provider}` : ""}`);
  if (m.description) console.log(m.description);
  if (m.legacyDbModels?.length) {
    console.log(`Also accepts: ${m.legacyDbModels.join(", ")}`);
  }
  for (const mode of m.modes ?? []) {
    console.log(`\nMode: ${mode.key}${mode.label ? ` (${mode.label})` : ""}`);
    // Fields can repeat across a mode's endpoints; list each key once.
    const seen = new Map<string, CatalogField>();
    for (const ep of mode.endpoints ?? []) {
      for (const f of ep.fields ?? []) if (!seen.has(f.key)) seen.set(f.key, f);
    }
    if (!seen.size) continue;
    formatTable([
      ["  INPUT", "DETAILS"],
      ...[...seen.values()].map((f) => [`  ${f.key}`, describeField(f)]),
    ]);
  }
  console.log(
    `\nPass inputs with --input <key>=<value> on \`unsora catalog quote|generate -m ${m.key}\`.`,
  );
}

/** `unsora models` / `unsora catalog list` — live model list from GET /catalog. */
export async function listModelsAction(
  model: string | undefined,
  opts: { category?: string; json?: boolean },
): Promise<void> {
  checkCategory(opts.category);
  const client = new UnsoraClient();
  try {
    const { raw, models } = await fetchModels(client, opts.category);

    if (model) {
      const m = findModel(models, model);
      if (!m) exitWithError(`Unknown model "${model}" — run \`unsora models\``);
      if (opts.json) printJson(m);
      else printModelDetail(m);
      return;
    }

    if (opts.json) {
      printJson(raw);
      return;
    }

    for (const category of CATALOG_CATEGORIES) {
      if (opts.category && opts.category !== category) continue;
      const rows = models.filter((m) => m.category === category);
      if (!rows.length) continue;
      console.log(`${category[0].toUpperCase()}${category.slice(1)}:`);
      formatTable([
        ["  MODEL", "NAME", "MODES"],
        ...rows.map((m) => [
          `  ${m.key}`,
          `${m.label ?? ""}${m.isNew ? " (new)" : ""}`,
          (m.modes ?? []).map((md) => md.key).join(", "),
        ]),
      ]);
      console.log("");
    }

    if (!opts.category) {
      console.log("Music (`unsora music create -m <model>`):");
      console.log(`  ${MUSIC_MODELS.join(", ")}\n`);
    }

    console.log("Details and inputs for one model: unsora models <model>");
    console.log("Price a run: unsora catalog quote -m <model> --input key=value");
    console.log(`App: ${APP_URL}   Docs: ${DOCS_URL}`);
  } catch (err) {
    exitWithError(err instanceof Error ? err.message : "Failed");
  }
}

function addInputOptions(cmd: Command): Command {
  return cmd
    .requiredOption("-m, --model <model>", "Model key from `unsora models`")
    .option(
      "--category <category>",
      `Guard: reject a model from another category (${CATALOG_CATEGORIES.join(", ")})`,
    )
    .option("--mode <mode>", "Mode key (default: picked from the attached media)")
    .option("-p, --prompt <text>", "Shortcut for --input prompt=<text>")
    .option(
      "-i, --input <key=value>",
      "Model input by its catalog key (repeatable; repeat a key for a list)",
      collect,
      [],
    )
    .option("--inputs <json>", "All inputs as a JSON object (merged under --input)");
}

function buildBody(opts: {
  model: string;
  category?: string;
  mode?: string;
  prompt?: string;
  input: string[];
  inputs?: string;
}): Record<string, unknown> {
  checkCategory(opts.category);
  let inputs: Record<string, unknown> = {};
  if (opts.inputs) {
    const raw = parseJsonOption("--inputs", opts.inputs);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("--inputs must be a JSON object");
    }
    inputs = { ...(raw as Record<string, unknown>) };
  }
  Object.assign(inputs, parseKeyValues(opts.input, "--input"));
  if (opts.prompt !== undefined) inputs.prompt = opts.prompt;

  return {
    model: opts.model,
    ...(opts.category ? { category: opts.category } : {}),
    ...(opts.mode ? { mode: opts.mode } : {}),
    inputs,
  };
}

export function registerCatalogCommands(program: Command): void {
  const catalog = program
    .command("catalog")
    .description(
      "Model-agnostic generation — list models, price a run, generate with any video/image/motion-control model",
    );

  catalog
    .command("list [model]", { isDefault: true })
    .description("List models from the live catalog, or show one model's modes and inputs")
    .option(
      "--category <category>",
      `Filter: ${CATALOG_CATEGORIES.join(", ")}`,
    )
    .option("--json", "Output as JSON")
    .action(listModelsAction);

  addInputOptions(
    catalog
      .command("quote")
      .description("Price one run with these inputs (free — nothing is charged)"),
  )
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const data = (await client.quoteCatalog(buildBody(opts))) as {
          credits?: number | null;
          mode?: string;
          modelId?: string;
          estimate?: boolean;
        };
        if (opts.json) {
          printJson(data);
          return;
        }
        if (data.credits === null || data.credits === undefined) {
          console.log("Price unknown until the required files are attached");
        } else {
          console.log(
            `${data.credits} credits${data.estimate ? " (estimate — required files missing)" : ""}`,
          );
        }
        if (data.mode || data.modelId) {
          console.log(`Mode: ${data.mode ?? "-"}  Endpoint: ${data.modelId ?? "-"}`);
        }
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });

  addInputOptions(
    catalog
      .command("generate")
      .description(
        "Start a video, image or motion-control generation with any catalog model",
      ),
  )
    .option(
      "--expected-credits <n>",
      "Most credits you agree to spend; if the live price is higher nothing is charged (409 PRICE_CHANGED)",
    )
    .option("--idempotency-key <key>", IDEMPOTENCY_HELP)
    .option("--no-wait", "Return immediately without polling")
    .option("-o, --output <file>", "Save the result to this file path")
    .option("--no-save", "Don't download the result file")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      const client = new UnsoraClient();
      try {
        const body = buildBody(opts);
        if (opts.expectedCredits !== undefined) {
          const n = Number(opts.expectedCredits);
          if (!Number.isInteger(n) || n <= 0) {
            exitWithError("--expected-credits must be a positive whole number");
          }
          body.expectedCredits = n;
        }

        // Category decides which status endpoint to poll.
        let category: string | undefined = opts.category;
        if (!category && opts.wait !== false) {
          const { models } = await fetchModels(client);
          category = findModel(models, opts.model)?.category;
        }

        const created = (await client.generateCatalog(body, {
          idempotencyKey: opts.idempotencyKey,
        })) as {
          generation?: { id?: string };
          creditsDeducted?: number;
        };
        const id = created.generation?.id;
        if (!id) exitWithError("No generation id in response");

        if (opts.wait === false) {
          if (opts.json) printJson(created);
          else console.log(`Queued: ${id}`);
          return;
        }

        const isImage = category === "image";
        const fetchStatus = (i: string): Promise<StatusData> =>
          isImage ? client.getImageStatus(i) : client.getVideoStatus(i);
        const kind = isImage ? "image" : category === "motion-control" ? "motion" : "video";

        const result = await pollUntilDone(client, fetchStatus, id, {
          label: isImage ? "Image" : category === "motion-control" ? "Motion control" : "Video",
          timeoutMs: isImage ? 600_000 : 900_000,
        });

        let savedTo: string | null = null;
        if (result.outputUrl && opts.save) {
          savedTo = await downloadToCwd(
            result.outputUrl,
            `unsora-${kind}-${id}`,
            opts.output,
          );
        }

        const out = {
          ...result,
          id,
          creditsDeducted: created.creditsDeducted,
          savedTo,
        };
        if (opts.json) printJson(out);
        else if (result.outputUrl) console.log(result.outputUrl);
        else console.log(id);
      } catch (err) {
        exitWithError(err instanceof Error ? err.message : "Failed");
      }
    });
}
