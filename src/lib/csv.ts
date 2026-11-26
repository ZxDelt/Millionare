/** Minimal RFC-4180 CSV parse/serialize (quotes, escaped quotes, CRLF, newlines in quoted fields). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = input.replace(/^﻿/, "");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map((v) => esc(v == null ? "" : String(v))).join(",")).join("\r\n") + "\r\n";
}

export const CSV_HEADER = ["text", "optionA", "optionB", "optionC", "optionD", "correct", "difficulty", "category", "explanation", "status"];
