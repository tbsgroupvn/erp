import { Injectable } from '@nestjs/common';

export interface ExportColumn {
  key: string;
  label: string;
}

@Injectable()
export class ExportService {
  /**
   * Converts an array of objects to a UTF-8 CSV string.
   * Values are quoted and internal quotes are escaped.
   */
  toCsv(data: Record<string, unknown>[], headers: ExportColumn[]): string {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel Vietnamese characters
    const headerRow = headers.map((h) => `"${h.label}"`).join(',');
    const rows = data.map((row) =>
      headers
        .map((h) => {
          const val = row[h.key] ?? '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(','),
    );
    return BOM + [headerRow, ...rows].join('\n');
  }

  /**
   * Generates a standalone HTML page with a printable/PDF-exportable table.
   * Includes a print button; the @media print CSS hides the button.
   */
  toHtmlTable(
    title: string,
    data: Record<string, unknown>[],
    headers: ExportColumn[],
    meta?: Record<string, string>,
  ): string {
    const metaHtml = meta
      ? Object.entries(meta)
          .map(([k, v]) => `<p><strong>${k}:</strong> ${v}</p>`)
          .join('')
      : '';
    const headerHtml = headers.map((h) => `<th>${h.label}</th>`).join('');
    const rowsHtml = data
      .map(
        (row) =>
          `<tr>${headers.map((h) => `<td>${row[h.key] ?? ''}</td>`).join('')}</tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 24px; color: #1a1a1a; }
    h2 { color: #1d4ed8; margin-bottom: 8px; }
    .meta { margin-bottom: 16px; color: #555; font-size: 11px; }
    .meta p { margin: 2px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 11px; }
    th { background: #1d4ed8; color: white; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    tr:hover { background: #eff6ff; }
    .footer { margin-top: 16px; font-size: 10px; color: #9ca3af; }
    .print-btn {
      margin-top: 16px; padding: 8px 20px; background: #1d4ed8; color: white;
      border: none; border-radius: 4px; cursor: pointer; font-size: 13px;
    }
    .print-btn:hover { background: #1e40af; }
    @media print {
      .print-btn { display: none; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <h2>${title}</h2>
  <div class="meta">${metaHtml}</div>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">Xuat bao cao luc: ${new Date().toLocaleString('vi-VN')}</div>
  <button class="print-btn" onclick="window.print()">In / Luu PDF</button>
</body>
</html>`;
  }
}
