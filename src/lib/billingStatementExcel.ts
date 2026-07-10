// ============================================================
// Billing Statement → Excel (.xlsx) export
// ============================================================
// Produces a formatted workbook that mirrors the on-screen "BILLING SUMMARY"
// (see src/pages/billing/BillingStatementPage.tsx + the reference in
// docs/references/billing-statement-format/): letterhead, customer block,
// account-summary box, the per-shop line-item table with subtotals, grand
// total, and END OF STATEMENT.
//
// `buildStatementWorkbook` is pure (no browser APIs) so it can be unit-tested
// in node; `exportBillingStatementXlsx` fetches the logo + triggers the browser
// download. exceljs is dynamically imported so it stays out of the main bundle.

import type { Workbook } from 'exceljs';

export interface StmtLineRow {
  date: string;       // mm/dd/yyyy
  poNumber: string;   // "ZAPP"
  drNumber: string;
  drAmount: number;
}

export interface StmtShopGroup {
  shopName: string;
  shopCode: string;
  rows: StmtLineRow[];
  subtotalDR: number;
  subtotalNet: number;
}

export interface StatementExportParams {
  companyName: string;
  companyAddress: string;
  customerName: string;
  payerCode: string;
  tin: string;
  address: string;
  statementDate: string;   // mm/dd/yyyy
  dueDate: string;         // mm/dd/yyyy
  currentLabel: string;    // e.g. "MAR.1-7,2026"
  refNo: string;
  totalStatement: number;
  groups: StmtShopGroup[];
  grandDR: number;
  grandNet: number;
  /** PNG bytes for the letterhead logo (optional; browser fetches it). */
  logoBuffer?: ArrayBuffer;
}

const AMT = '#,##0.000';
const HEADER_FILL = 'FFF3F4F6';
const SUB_FILL = 'FFFAFAFA';
const GRAND_FILL = 'FFEEF2FF';

const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
const box = { top: thin, left: thin, bottom: thin, right: thin };

const COLS = 10; // A..J

const TABLE_HEADERS = [
  'Delivery Date',
  'PO Number',
  'DR Number',
  'Shop Code',
  'Shop Name',
  'DR Amount (Vat Inc.)',
  'Returns (Credit) (Vat Inc.)',
  'Delivery Adjustment (Credit) (Vat Inc.)',
  'Merch. Allowance (Vat Inc.)',
  'Net Amount (Vat Inc.)',
];

export async function buildStatementWorkbook(p: StatementExportParams): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Billing Summary', { views: [{ showGridLines: false }] });

  ws.columns = [
    { width: 12 }, { width: 10 }, { width: 18 }, { width: 12 }, { width: 32 },
    { width: 14 }, { width: 13 }, { width: 16 }, { width: 15 }, { width: 15 },
  ];

  // ── Letterhead ─────────────────────────────────────────────
  const titleRows: Array<[string, number, boolean]> = [
    [p.companyName, 14, true],
    [p.companyAddress, 9, false],
    ['BILLING SUMMARY', 12, true],
  ];
  titleRows.forEach(([text, size, bold], i) => {
    const r = i + 1;
    ws.mergeCells(r, 1, r, COLS);
    const cell = ws.getCell(r, 1);
    cell.value = text;
    cell.font = { bold, size };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  ws.getRow(1).height = 22;
  ws.getRow(3).height = 18;

  if (p.logoBuffer) {
    try {
      const imgId = wb.addImage({ buffer: p.logoBuffer as ArrayBuffer, extension: 'png' });
      // Anchor top-left, overlaying the left of the merged title band.
      ws.addImage(imgId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 150, height: 78 } } as never);
    } catch {
      /* logo is best-effort */
    }
  }

  // ── Customer block (left) + Account Summary box (right) ────
  const cust: Array<[string, string]> = [
    ['Customer Name:', p.customerName],
    ['Payer Code:', p.payerCode],
    ['Tin No.:', p.tin],
    ['Address:', p.address],
  ];
  cust.forEach((pair, i) => {
    const r = 5 + i;
    const label = ws.getCell(r, 1);
    label.value = pair[0];
    label.font = { bold: true, size: 10 };
    ws.mergeCells(r, 2, r, 4);
    const val = ws.getCell(r, 2);
    val.value = pair[1];
    val.font = { size: 10 };
  });

  const acct: Array<[string, string | number, boolean]> = [
    ['Account Summary', 'Page 1 of 1', true],
    ['Statement Date', p.statementDate, false],
    ['Payment Due Date', p.dueDate, false],
    [`Current ${p.currentLabel}`, p.totalStatement, false],
    ['Ref. Doc No.', p.refNo, false],
    ['Total Statement (Vat Inc.)', p.totalStatement, true],
  ];
  acct.forEach((row, i) => {
    const r = 5 + i;
    ws.mergeCells(r, 7, r, 9); // G:I label
    const lab = ws.getCell(r, 7);
    lab.value = row[0];
    lab.font = { bold: row[2] || i === 0, size: 10 };
    if (i === 0) lab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    // Border every cell of the merged label + the value so the box is closed.
    for (let c = 7; c <= 9; c++) {
      const cell = ws.getCell(r, c);
      cell.border = box;
      if (i === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    }
    const val = ws.getCell(r, 10);
    if (typeof row[1] === 'number') {
      val.value = row[1];
      val.numFmt = AMT;
    } else {
      val.value = row[1];
    }
    val.font = { bold: row[2], size: 10 };
    val.alignment = { horizontal: 'right' };
    val.border = box;
  });

  // ── Line-item table ────────────────────────────────────────
  let r = 12;
  const headerRow = ws.getRow(r);
  TABLE_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = box;
  });
  headerRow.height = 34;
  r++;

  const putDataRow = (vals: Array<string | number>) => {
    const row = ws.getRow(r);
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.font = { size: 9 };
      cell.border = box;
      if (i >= 5) {
        cell.numFmt = AMT;
        cell.alignment = { horizontal: 'right' };
      }
    });
    r++;
  };

  const putSummaryRow = (label: string, dr: number, net: number, fill: string) => {
    const row = ws.getRow(r);
    ws.mergeCells(r, 1, r, 5); // label spans A:E
    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      if (c === 1) {
        cell.value = label;
        cell.font = { bold: true, size: 9 };
      }
      cell.border = box;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    }
    const amounts = [dr, 0, 0, 0, net];
    amounts.forEach((v, i) => {
      const cell = row.getCell(6 + i);
      cell.value = v;
      cell.numFmt = AMT;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'right' };
      cell.border = box;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    });
    r++;
  };

  for (const g of p.groups) {
    for (const line of g.rows) {
      putDataRow([
        line.date, line.poNumber, line.drNumber, g.shopCode, g.shopName,
        line.drAmount, 0, 0, 0, line.drAmount,
      ]);
    }
    putSummaryRow(`Total ${g.shopName}`, g.subtotalDR, g.subtotalNet, SUB_FILL);
  }
  putSummaryRow('GRAND TOTAL', p.grandDR, p.grandNet, GRAND_FILL);

  // ── End of statement ───────────────────────────────────────
  r += 1;
  ws.mergeCells(r, 1, r, COLS);
  const eos = ws.getCell(r, 1);
  eos.value = '***END OF STATEMENT***';
  eos.font = { bold: true, size: 10 };
  eos.alignment = { horizontal: 'center' };

  return wb;
}

export async function exportBillingStatementXlsx(
  params: Omit<StatementExportParams, 'logoBuffer'> & { logoUrl?: string; fileName: string },
): Promise<void> {
  let logoBuffer: ArrayBuffer | undefined;
  if (params.logoUrl) {
    try {
      logoBuffer = await (await fetch(params.logoUrl)).arrayBuffer();
    } catch {
      logoBuffer = undefined;
    }
  }

  const wb = await buildStatementWorkbook({ ...params, logoBuffer });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = params.fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Defer cleanup so the browser finishes initiating the download (and picks
  // up the `download` filename) before the object URL is revoked. Revoking it
  // synchronously can make some browsers fall back to a generic blob-id name.
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}
