import type { ReactNode } from 'react';

/** A value ExcelJS can write into a cell without further coercion. */
export type ExportCellValue = string | number | boolean | Date | null;

export interface ExportCellStyle {
  /** Solid background fill, ARGB (e.g. 'FFDC2626'). */
  fill?: string;
  /** Font colour, ARGB. */
  fontColor?: string;
  bold?: boolean;
}

/**
 * A fully-resolved sheet column: no dependency on table column types, so
 * `buildWorkbook` stays independent of how the columns were derived.
 */
export interface ExportColumnSpec<T = unknown> {
  header: string;
  getValue: (item: T) => ExportCellValue;
  getStyle?: (value: ExportCellValue, item: T) => ExportCellStyle | undefined;
}

export interface SheetSpec<T = unknown> {
  /** Pre-sanitizing name. `buildWorkbook` sanitizes and de-duplicates. */
  name: string;
  columns: ExportColumnSpec<T>[];
  rows: T[];
}

/**
 * What an EasyVisionTable registers so an export button can pull from it.
 * Both resolvers run at export time, never at registration time, so a column
 * toggle or a new multifilter query needs no re-registration.
 */
export interface ExportSource<T = unknown> {
  /** Default sheet name. The button's `sheetNames` map overrides it. */
  sheetName: string;
  getColumns: () => ExportColumnSpec<T>[];
  getRows: () => Promise<T[]>;
}

export interface ExportLabels {
  export: string;
  exporting: string;
}

export interface EasyVisionExportButtonProps {
  /**
   * Table ids, in sheet order. Each id is resolved namespace-first — qualified
   * through the surrounding namespace, the same way a nested id is resolved
   * elsewhere in this library — and only falls back to the raw id verbatim if
   * that namespaced lookup misses.
   */
  tables: string[];
  /** Timestamp and `.xlsx` are appended. */
  filename: string;
  /** Per-table sheet-name override, keyed by the same id passed in `tables`. */
  sheetNames?: Record<string, string>;
  labels?: Partial<ExportLabels>;
  /** Fetch or workbook failure. The export is aborted whole; no partial file. */
  onError?: (error: unknown) => void;
  /** Nothing to export — no file was written. */
  onEmpty?: () => void;
  disabled?: boolean;
  className?: string;
  /** Replaces the default download icon. */
  icon?: ReactNode;
}
