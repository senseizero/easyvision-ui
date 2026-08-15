import { useMemo } from 'react';
import type { EasyVisionColumn, TableMode } from '../types/table.types';
import { sortLocalRows } from './sortLocalRows';

export interface UseTableDataParams<T> {
  data: T[] | undefined;
  columns: EasyVisionColumn<T>[];
  page: number;
  itemsPerPage: number;
  sort: { column: string; descending: boolean } | null;
  paginationMode: TableMode;
  orderingMode: TableMode;
}

export interface UseTableDataResult<T> {
  rows: T[];
  totalCount: number;
}

export function useTableData<T>({
  data,
  columns,
  page,
  itemsPerPage,
  sort,
  paginationMode,
  orderingMode,
}: UseTableDataParams<T>): UseTableDataResult<T> {
  return useMemo<UseTableDataResult<T>>(() => {
    let rows: T[] = data ?? [];

    if (orderingMode === 'local' && sort) {
      rows = sortLocalRows(rows, columns, sort);
    }

    const totalCount = rows.length;

    if (paginationMode === 'local') {
      const start = (page - 1) * itemsPerPage;
      rows = rows.slice(start, start + itemsPerPage);
    }

    return { rows, totalCount };
  }, [data, columns, page, itemsPerPage, sort, paginationMode, orderingMode]);
}
