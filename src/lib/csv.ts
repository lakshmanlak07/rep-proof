// CSV for data export. Pure; tested in beta.test.ts.

/** RFC 4180 field: quoted when it contains a comma, quote or newline. Formula-like text is prefixed with ' so
 * spreadsheets do not run it (CSV injection). */
export function csvField(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows to CSV with a header from `columns` (in that order). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => csvField(r[c])).join(','))].join('\r\n') + '\r\n';
}
