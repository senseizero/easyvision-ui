import ExcelJS from 'exceljs';
import type { SheetSpec } from '../types/export.types';

const HEADER_FILL_ARGB = 'FFCCCCCC';
const MIN_COLUMN_WIDTH = 10;
const COLUMN_WIDTH_PADDING = 2;
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const INVALID_SHEET_CHARS = /[*?:\\/[\]]/g;
const MAX_SHEET_NAME = 31;
const FALLBACK_SHEET_NAME = 'Hoja';

export const sanitizeSheetName = (name: string): string =>
  name.replace(INVALID_SHEET_CHARS, '-').substring(0, MAX_SHEET_NAME) ||
  FALLBACK_SHEET_NAME;

/**
 * ExcelJS throws on duplicate worksheet names, so this must always return a
 * name not already used. Tracking final names (not bases) means a generated
 * `Foo_2` cannot collide with a source sheet genuinely called `Foo_2`.
 */
const uniqueSheetName = (raw: string, taken: Set<string>): string => {
  const base = sanitizeSheetName(raw);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = base.substring(0, MAX_SHEET_NAME - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
};

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
  // Revoking in the same tick as `click()` races the download start in some
  // browsers (Safari has historically dropped downloads revoked this early;
  // Chrome tolerates it because it starts the download during click
  // dispatch). Defer to a later tick so the revoke can't outrun it.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.columns.forEach((column) => {
    let longest = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      // `cell.text` is exceljs's rendered-text accessor and already reports ''
      // for a null cell, so no separate null case is needed. But with no
      // `numFmt` set, a Date's `.text` falls back to `Date.prototype.toString()`
      // — long and timezone-dependent — so dates are measured via their fixed-
      // length ISO string instead (same convention as the filename timestamp
      // in `exportSheets` below).
      const length =
        cell.value instanceof Date ? cell.value.toISOString().length : cell.text.length;
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
  const usable = sheets.filter(
    (sheet) => sheet.rows.length > 0 && sheet.columns.length > 0
  );
  if (usable.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const takenNames = new Set<string>();

  for (const sheet of usable) {
    const worksheet = workbook.addWorksheet(uniqueSheetName(sheet.name, takenNames));

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
