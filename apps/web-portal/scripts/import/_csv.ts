import * as fs from "node:fs";

export type CsvRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  while (i < line.length) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        cur += "\"";
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    cur += ch;
    i += 1;
  }
  out.push(cur);
  return out;
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((raw) => {
    const base = (raw ?? "").trim() || "column";
    const c = seen.get(base) ?? 0;
    seen.set(base, c + 1);
    return c === 0 ? base : `${base}__${c + 1}`;
  });
}

export function readCsvFile(path: string): { headers: string[]; rows: CsvRow[] } {
  const raw = fs.readFileSync(path, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = raw.split("\n").filter((l, idx, arr) => !(idx === arr.length - 1 && l === ""));
  if (lines.length === 0) return { headers: [], rows: [] };

  const headerCells = parseCsvLine(lines[0]);
  const headers = uniqueHeaders(headerCells);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (cells[j] ?? "").trim();
    }
    rows.push(row);
  }
  return { headers, rows };
}

