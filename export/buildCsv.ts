/**
 * Sheets to CSV (`EasyVisionExportButton format="csv"`). Ported from nml-vision
 * v3's data-table. The same columns, rows and values the Excel export writes;
 * only the file differs.
 *
 * Excel is the reader that matters, and it reads by the machine's locale: a
 * Spanish, Portuguese or French Excel splits on `;` (and reads decimals with
 * `,`), so the host picks the delimiter for its users' language. The BOM is
 * what makes Excel read the file as UTF-8 instead of Latin-1.
 */
import type { ExportCellValue, SheetSpec } from '../types/export.types';
import { downloadBlob } from './buildWorkbook';

export type CsvDelimiter = ',' | ';';

const BOM = '﻿';
const CSV_MIME = 'text/csv;charset=utf-8';

/** One sheet as CSV text. With `;`, decimals are written with `,` (0,81). */
export function buildCsv<T>(sheet: SheetSpec<T>, delimiter: CsvDelimiter = ','): string {
  const line = (cells: string[]) => cells.map((cell) => quote(cell, delimiter)).join(delimiter);
  const header = line(sheet.columns.map((column) => column.header));
  const rows = sheet.rows.map((item) =>
    line(sheet.columns.map((column) => cellText(column.getValue(item), delimiter)))
  );
  return BOM + [header, ...rows].join('\r\n') + '\r\n';
}

function cellText(value: ExportCellValue, delimiter: CsvDelimiter): string {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'number') {
    const text = String(value);
    return delimiter === ';' ? text.replace('.', ',') : text;
  }
  return String(value);
}

/**
 * RFC 4180: quote when the value carries THIS file's delimiter, a quote or a
 * newline. Not the other delimiter: with `;`, a decimal "0,81" quoted would
 * risk Excel reading it as text.
 */
function quote(value: string, delimiter: string): string {
  if (!/["\r\n]/.test(value) && !value.includes(delimiter)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export interface ExportCsvOptions {
  /** Timestamp and `.csv` are appended (and the sheet name, with several). */
  filename: string;
  delimiter?: CsvDelimiter;
  /** Injectable for tests. Defaults to an object-URL anchor click. */
  download?: (blob: Blob, filename: string) => void;
}

/**
 * Writes the sheets as CSV files: CSV has no sheets, so one file each. Empty
 * sheets (no rows or no columns) are skipped. Returns false when nothing was
 * written.
 */
export function exportCsv<T>(sheets: SheetSpec<T>[], options: ExportCsvOptions): boolean {
  const usable = sheets.filter((sheet) => sheet.rows.length > 0 && sheet.columns.length > 0);
  if (usable.length === 0) return false;
  const stamp = new Date().toISOString();
  for (const sheet of usable) {
    const name =
      usable.length === 1
        ? `${options.filename}_${stamp}.csv`
        : `${options.filename}_${sheet.name}_${stamp}.csv`;
    const blob = new Blob([buildCsv(sheet, options.delimiter)], { type: CSV_MIME });
    (options.download ?? downloadBlob)(blob, name);
  }
  return true;
}
