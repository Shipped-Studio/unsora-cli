export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printError(message: string): void {
  console.error(`Error: ${message}`);
  process.exitCode = 1;
}

export function exitWithError(message: string): never {
  printError(message);
  process.exit(1);
}

export function formatTable(rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(empty)");
    return;
  }
  const widths = rows[0].map((_, col) =>
    Math.max(...rows.map((row) => (row[col] ?? "").length)),
  );
  for (const row of rows) {
    console.log(
      row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  "),
    );
  }
}
