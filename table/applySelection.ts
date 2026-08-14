import type { TableSelection } from '../store/slice-types';

/**
 * Narrow a fully-materialized row set to what the user actually selected:
 * the ticked rows when there is a selection, everything otherwise.
 *
 * Filtering a full set — rather than reading whatever happens to sit in the
 * current page's state — is what makes a selection spanning pages that were
 * never loaded come out right.
 */
export function applySelection<T>(
  rows: T[],
  selection: TableSelection,
  getRowId: (row: T) => string
): T[] {
  if (selection.scope === 'all') {
    const except = selection.exceptIds;
    if (!except || Object.keys(except).length === 0) return rows;
    return rows.filter((row) => !except[getRowId(row)]);
  }

  const ids = selection.ids;
  if (!ids || Object.keys(ids).length === 0) return rows;
  return rows.filter((row) => ids[getRowId(row)]);
}
