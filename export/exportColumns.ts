import { getByPath } from '../lib/isNestedAccessor';
import type { EasyVisionColumn } from '../types/table.types';
import type { ExportCellValue, ExportColumnSpec } from '../types/export.types';

/** Coerce an arbitrary row value into something a cell can hold. */
export const toExportCellValue = (raw: unknown): ExportCellValue => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw instanceof Date) return raw;
  const kind = typeof raw;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') {
    return raw as ExportCellValue;
  }
  return String(raw);
};

/** `data` columns export by default; `ui` columns must opt in. */
export const isExportable = <T>(column: EasyVisionColumn<T>): boolean =>
  column.exportable ?? column.type !== 'ui';

export const exportHeaderOf = <T>(column: EasyVisionColumn<T>): string =>
  column.exportHeader ??
  (typeof column.header === 'string' ? column.header : column.field);

/**
 * Flatten table columns into sheet columns, keeping the declared order.
 * `isVisible` is supplied by the caller so this stays free of slice access.
 */
export function toExportColumns<T>(
  columns: EasyVisionColumn<T>[],
  isVisible: (field: string) => boolean
): ExportColumnSpec<T>[] {
  return columns
    .filter((column) => isExportable(column) && isVisible(column.field))
    .map((column) => {
      const exportValue = column.exportValue;
      const exportStyle = column.exportStyle;
      const field = column.field;
      const isUi = column.type === 'ui';
      return {
        header: exportHeaderOf(column),
        getValue: (item: T): ExportCellValue => {
          if (exportValue) return toExportCellValue(exportValue(item));
          // A `ui` column has no underlying value; opting it in without an
          // `exportValue` yields an empty column rather than a crash.
          if (isUi) return null;
          return toExportCellValue(getByPath(item, field));
        },
        getStyle: exportStyle
          ? (value: ExportCellValue, item: T) => exportStyle(value, item)
          : undefined,
      };
    });
}
