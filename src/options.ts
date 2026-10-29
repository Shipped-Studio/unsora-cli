/** Shared option helpers for commands. */

/** Commander collector for repeatable options. */
export function collect(value: string, prev: string[]): string[] {
  return prev.concat([value]);
}

/** Help text for `--idempotency-key` on create commands. */
export const IDEMPOTENCY_HELP =
  "Idempotency-Key header — retrying with the same key replays the first response instead of charging again (24h)";

/** Parse a JSON option value, exiting with a readable message on failure. */
export function parseJsonOption(name: string, raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

/**
 * Turn repeated `key=value` pairs into an object. Repeating a key builds an
 * array. Values starting with `[` or `{` are parsed as JSON; everything else
 * is sent as a string (the API casts numbers, booleans and enum values).
 */
export function parseKeyValues(
  pairs: string[],
  optionName: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      throw new Error(`${optionName} expects key=value, got "${pair}"`);
    }
    const key = pair.slice(0, eq).trim();
    const raw = pair.slice(eq + 1);
    let value: unknown = raw;
    if (/^\s*[[{]/.test(raw)) {
      value = parseJsonOption(`${optionName} ${key}`, raw);
    }
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}
