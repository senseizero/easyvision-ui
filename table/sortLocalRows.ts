import type { ApiFetchParams, EasyVisionColumn } from '../types/table.types';
import { compareByPath } from '../lib/compareByPath';

/**
 * Sort a local (in-memory) row set by the table's active sort state.
 *
 * Extracted from `useTableData`'s local-sort branch so the same rule can be
 * reused by local-mode exports, which otherwise return rows in raw `data`
 * order (the API export branch gets its sort from the server via
 * `fetchAllRows`; local mode has no equivalent unless this is called
 * explicitly).
 *
 * Returns `rows` unchanged (same reference, not a copy) when there is no
 * sort, or when the sort column isn't a known, sortable `data` column —
 * matching `useTableData`'s existing behaviour. Otherwise returns a sorted
 * copy; the input array is never mutated.
 */
export function sortLocalRows<T>(
  rows: T[],
  columns: EasyVisionColumn<T>[],
  sort: ApiFetchParams['sort']
): T[] {
  if (!sort) return rows;
  const col = columns.find((c) => c.field === sort.column);
  if (!col || col.type === 'ui') return rows;
  const next = [...rows];
  next.sort((a, b) => compareByPath(a, b, col.field, sort.descending));
  return next;
}
