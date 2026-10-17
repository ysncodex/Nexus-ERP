/** Quote a CSV cell and neutralise spreadsheet formula injection. */
export function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** UTF-8 BOM + CRLF so Excel opens Bangla text and line breaks correctly. */
export function toCsv(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
