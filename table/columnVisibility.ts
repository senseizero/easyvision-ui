import type { EasyVisionColumn } from '../types/table.types';

/**
 * Merge declared `initiallyHidden` defaults with the user's toggles from the
 * table slice.
 *
 * Defaults are *not* baked into the slice; they're merged here at read time.
 * That way a column added to `columns` after the slice was persisted still
 * picks up its declared default — had we seeded the slice with defaults, the
 * missing key for the new column would silently render it visible.
 */
export function resolveColumnVisibility<T>(
  columns: EasyVisionColumn<T>[],
  sliceVisibility: Record<string, boolean>
): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const column of columns) {
    if (column.initiallyHidden) defaults[column.field] = false;
  }
  return { ...defaults, ...sliceVisibility };
}

/** A column is visible unless explicitly set to false. */
export const isColumnVisible = (
  visibility: Record<string, boolean>,
  field: string
): boolean => visibility[field] !== false;
