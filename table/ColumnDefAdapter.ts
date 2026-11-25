import { createElement, type ReactNode } from 'react';
import type { ColumnDef, RowData } from '@tanstack/react-table';
import type {
  DefaultSortingMode,
  EasyVisionColumn,
  TableMode,
} from '../types/table.types';

export const isNestedField = (field: string): boolean => field.includes('.');

const resolvePath = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (acc, key) =>
      acc != null && typeof acc === 'object'
        ? (acc as Record<string, unknown>)[key]
        : undefined,
    obj
  );

export function shouldDisableSorting<T>(
  col: EasyVisionColumn<T>,
  orderingMode: TableMode,
  defaultSorting: DefaultSortingMode = 'nonNested'
): boolean {
  if (col.type === 'ui') return true;
  if (col.sortable === false) return true;
  if (col.sortable === true) return false;
  // Fallback per defaultSorting policy.
  if (defaultSorting === 'disabled') return true;
  if (defaultSorting === 'all') return false;
  // 'nonNested': nested fields off in api mode (most APIs can't sort by them).
  if (orderingMode === 'api' && isNestedField(col.field)) return true;
  return false;
}

/**
 * One cell component per column, kept across renders. TanStack's flexRender
 * renders a cell function as a component, so a new function per render is a
 * new component type, and React would remount every cell of the table each
 * time the host passes new column objects (the usual, unmemoized case). The
 * component stays; it renders whatever `cell` the latest columns carry.
 */
export type CellCache = Map<string, CellEntry>;
interface CellEntry {
  render?: (row: any) => ReactNode;
  Comp: (props: { row: { original: unknown }; getValue: () => unknown }) => ReactNode;
}

function stableCell(cache: CellCache, field: string, render: CellEntry['render']) {
  let entry = cache.get(field);
  if (!entry) {
    const created: CellEntry = {
      Comp: ({ row, getValue }) =>
        created.render
          ? created.render(row.original)
          : createElement('span', { className: 'text-sm text-foreground' }, String(getValue() ?? '-')),
    };
    cache.set(field, created);
    entry = created;
  }
  entry.render = render;
  return entry.Comp;
}

export function adaptColumns<T extends RowData>(
  columns: EasyVisionColumn<T>[],
  orderingMode: TableMode,
  defaultSorting: DefaultSortingMode = 'nonNested',
  cellCache: CellCache = new Map()
): ColumnDef<T>[] {
  return columns.map((c) => {
    // Resolve the *initial* width. For resizable columns we fall back to a
    // sensible default so users have something to drag from.
    const widthCss =
      typeof c.width === 'number' ? `${c.width}px` : c.width;
    const numericWidth =
      typeof c.width === 'number'
        ? c.width
        : typeof c.width === 'string' && /^\d+px$/.test(c.width)
        ? parseInt(c.width, 10)
        : undefined;

    const meta = {
      initiallyHidden: !!c.initiallyHidden,
      largeScreensOnly: !!c.largeScreensOnly,
      width: widthCss,
      truncate: !!c.truncate,
      resizable: !!c.resizable,
    };
    const isUi = c.type === 'ui';
    const userCell = c.cell;

    const wrappedCell = stableCell(cellCache, c.field, userCell);

    const base: Record<string, unknown> = {
      id: c.field,
      header: c.header,
      cell: wrappedCell,
      enableSorting: !shouldDisableSorting(c, orderingMode, defaultSorting),
      enableHiding: true,
      enableResizing: !!c.resizable,
      meta,
    };

    if (c.resizable) {
      base.size = numericWidth ?? 240;
      base.minSize = 60;
    } else if (numericWidth !== undefined) {
      base.size = numericWidth;
    }

    if (!isUi) {
      base.accessorFn = (row: T) => resolvePath(row, c.field);
    }

    return base as unknown as ColumnDef<T>;
  });
}
