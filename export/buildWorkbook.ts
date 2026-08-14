import ExcelJS from 'exceljs';
import type { SheetSpec } from '../types/export.types';

const HEADER_FILL_ARGB = 'FFCCCCCC';
const MIN_COLUMN_WIDTH = 10;
const COLUMN_WIDTH_PADDING = 2;
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExportSheetsOptions {
  /** Timestamp and `.xlsx` are appended. */
  filename: string;
  /** Injectable for tests. Defaults to an object-URL anchor click. */
  download?: (blob: Blob, filename: string) => void;
}

/** Native download — no file-saver needed. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.columns.forEach((column) => {
    let longest = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length =
        cell.value == null ? MIN_COLUMN_WIDTH : String(cell.value).length;
      if (length > longest) longest = length;
    });
    column.width = Math.max(MIN_COLUMN_WIDTH, longest + COLUMN_WIDTH_PADDING);
  });
};

/**
 * Assemble sheets into a workbook. Returns `null` when nothing was worth
 * writing, so callers can distinguish "no file" from "empty file".
 */
export async function buildWorkbook<T>(
  sheets: SheetSpec<T>[]
): Promise<ExcelJS.Workbook | null> {
  if (sheets.length === 0) return null;

  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    const headerRow = worksheet.addRow(sheet.columns.map((c) => c.header));
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL_ARGB },
      };
      cell.font = { bold: true };
    });

    for (const item of sheet.rows) {
      const values = sheet.columns.map((column) => column.getValue(item));
      const row = worksheet.addRow(values);
      sheet.columns.forEach((column, index) => {
        const style = column.getStyle?.(values[index], item);
        if (!style) return;
        const cell = row.getCell(index + 1);
        if (style.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: style.fill },
          };
        }
        if (style.fontColor || style.bold) {
          cell.font = {
            bold: !!style.bold,
            ...(style.fontColor ? { color: { argb: style.fontColor } } : {}),
          };
        }
      });
    }

    autoFitColumns(worksheet);
  }

  return workbook;
}

/** Build and hand the file to the browser. Returns false when no file was written. */
export async function exportSheets<T>(
  sheets: SheetSpec<T>[],
  options: ExportSheetsOptions
): Promise<boolean> {
  const workbook = await buildWorkbook(sheets);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const filename = `${options.filename}_${new Date().toISOString()}.xlsx`;
  (options.download ?? downloadBlob)(blob, filename);
  return true;
}
