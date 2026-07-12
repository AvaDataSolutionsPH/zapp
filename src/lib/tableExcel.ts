// ============================================================
// Generic table → Excel (.xlsx) export
// ============================================================
// A small, reusable "what you see is what you get" spreadsheet export: hand it
// the on-screen column headers + row objects and it produces a formatted .xlsx
// (bold bordered header, per-column number formats + alignment). Used by the
// Billing page "Export Excel" button so the download mirrors the table exactly
// (per-DR statement rows for the billing user, aggregated billing records for
// everyone else) — replacing the old plain-CSV stub that pulled from empty mock
// data and never matched the printable Billing Statement.
//
// `buildTableWorkbook` is pure (no browser APIs) so it can be unit-tested in
// node; `exportTableXlsx` triggers the browser download. exceljs is dynamically
// imported so it stays out of the main bundle (same lazy chunk as the statement
// export).

import type { Workbook } from 'exceljs';

export interface XlsxColumn {
  /** Column header text (row 1). */
  header: string;
  /** Key into each row object. */
  key: string;
  /** Column width in Excel units (default 16). */
  width?: number;
  /** Excel number format for the column's cells, e.g. '#,##0.000'. When set,
   *  the row value should be a real number so Excel can sum/format it. */
  numFmt?: string;
  /** Horizontal alignment (defaults: right for numeric columns, else left). */
  align?: 'left' | 'right' | 'center';
}

const HEADER_FILL = 'FFF3F4F6';
const thin = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

export async function buildTableWorkbook(
  sheetName: string,
  columns: XlsxColumn[],
  rows: Array<Record<string, string | number>>,
): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));

  // Header row (row 1).
  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = box;
  });

  // Data rows.
  for (const r of rows) {
    const row = ws.addRow(columns.map((c) => r[c.key] ?? ''));
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { size: 9 };
      cell.border = box;
      if (c.numFmt) cell.numFmt = c.numFmt;
      const align = c.align ?? (c.numFmt ? 'right' : 'left');
      cell.alignment = { horizontal: align, vertical: 'middle' };
    });
  }

  return wb;
}

export async function exportTableXlsx(
  fileName: string,
  sheetName: string,
  columns: XlsxColumn[],
  rows: Array<Record<string, string | number>>,
): Promise<void> {
  const wb = await buildTableWorkbook(sheetName, columns, rows);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Defer cleanup so the browser keeps the `download` filename (revoking the
  // object URL synchronously can fall back to a generic blob-id name).
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
