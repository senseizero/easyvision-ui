import * as React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
  type ColumnSizingState,
  type RowData,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import { NamespaceProvider } from '../store/NamespaceContext';
import { adaptColumns, shouldDisableSorting, type CellCache } from './ColumnDefAdapter';
import { useTableData } from './useTableData';
import { applySelection } from './applySelection';
import { resolveColumnVisibility, isColumnVisible } from './columnVisibility';
import { fetchAllRows, mergeFilters } from './fetchAllRows';
import { sortLocalRows } from './sortLocalRows';
import { SelectAllControl } from './SelectAllControl';
import { PaginationFooter } from './PaginationFooter';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { fitColumns } from './autofit';
import { EasyVisionMultifilter, type MultifilterHandle } from '../multifilter/EasyVisionMultifilter';
import { createLoopbackTableFetcher, matchLoopbackWhere } from '../adapters/loopback';
import { createIngotTableFetcher } from '../adapters/ingot';
import { registerExportSource, unregisterExportSource } from '../export/sources';
import { toExportColumns } from '../export/exportColumns';
import type {
  EasyVisionTableProps,
  SelectionChange,
  TableLabels,
  TableMode,
} from '../types/table.types';
import type { MultifilterSnapshot } from '../types/multifilter.types';
import type { TableSliceData } from '../store/slice-types';
import './EasyVisionTable.css';

const DEFAULT_LABELS: TableLabels = {
  rowsPerPage: 'Resultados por página:',
  results: 'Resultados',
  page: 'Página:',
  of: 'de',
  noData: 'Sin datos',
  loading: 'Cargando...',
  customizeColumns: 'Columnas',
  selectAllPage: 'Seleccionar página',
  selectAllAll: 'Seleccionar todo',
  selectedAllBanner: (n: number) => `Todos los ${n} registros seleccionados`,
  selectedCountBanner: (n: number) => `${n} ${n === 1 ? 'registro seleccionado' : 'registros seleccionados'}`,
  clearSelection: 'Limpiar selección',
  selectRow: 'Seleccionar',
  previousPage: 'Página anterior',
  nextPage: 'Página siguiente',
  noRoom: '(sin sitio)',
};

/**
 * A click the row must not take as "open the row": one on something of its
 * own inside a cell (a link, a button, a menu, a checkbox), or one that only
 * bubbled up through React from a portal (a menu's item) and never touched
 * the row in the DOM.
 */
function isFromWithinControl(e: React.MouseEvent<HTMLElement>): boolean {
  const target = e.target as Element | null;
  if (!target || !e.currentTarget.contains(target)) return true;
  const control = target.closest(
    'a, button, input, select, textarea, label, [role="button"], [role="menuitem"], [role="checkbox"], [role="menu"]'
  );
  return !!control && e.currentTarget.contains(control) && control !== e.currentTarget;
}

export function EasyVisionTable<T extends RowData>(props: EasyVisionTableProps<T>) {
  const {
    id,
    columns,
    paginationMode: paginationModeProp = 'local',
    orderingMode: orderingModeProp = 'local',
    defaultSorting = 'nonNested',
    data,
    fetchData: fetchDataProp,
    loopback,
    ingot,
    defaultSort,
    reloadSignal,
    ariaLabel,
    getRowLabel,
    renderDetail,
    expandedIds,
    getDetailId,
    columnFit = 'scroll',
    onDataLoaded,
    multifilter,
    multifilterRef,
    refetchSignal,
    externalFilter,
    localMatch: localMatchProp,
    getRowId: getRowIdProp,
    itemsPerPage: itemsPerPageProp = 10,
    itemsPerPageOptions = [10, 15, 20],
    paginationDisplay = 'always',
    enableRowSelection = false,
    selectAllScope = 'toggleable',
    selectAllResolution = 'lazy',
    onSelectionChange,
    isLoading: isLoadingProp = false,
    emptyMessage,
    emptyAction,
    onRowClick,
    isRowHighlighted,
    toolbarLeft,
    toolbarRight,
    showColumnVisibility = true,
    maxBodyHeight,
    labels: labelOverrides,
    className,
    persist = false,
  } = props;

  const labels: TableLabels = { ...DEFAULT_LABELS, ...labelOverrides };

  // The `loopback` prop is a declarative shortcut that builds the api-mode
  // fetcher for the user and forces both modes to 'api'. Explicit `fetchData`
  // wins if both are provided (escape hatch for custom queries).
  //
  // The fetcher is rebuilt only when the *contents* of `loopback` change, so
  // callers can pass an inline object literal without triggering a refetch
  // each render. Functions are compared by reference; arrays of strings/
  // simple objects are compared by JSON serialization (cheap at this size).
  const lbFetchPage = loopback?.fetchPage;
  const lbFetchCount = loopback?.fetchCount;
  const lbIncludeKey = JSON.stringify(loopback?.include ?? null);
  const lbFieldsKey = JSON.stringify(loopback?.fields ?? null);
  const lbOrderKey = JSON.stringify(loopback?.defaultOrder ?? null);
  const loopbackFetcher = useMemo(
    () => (loopback ? createLoopbackTableFetcher<T>(loopback) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lbFetchPage, lbFetchCount, lbIncludeKey, lbFieldsKey, lbOrderKey]
  );
  // `ingot` is the same shortcut for NML v3 (ingot) backends; same memo rules.
  const igFetchPage = ingot?.fetchPage;
  const igIncludeKey = JSON.stringify(ingot?.include ?? null);
  const igFieldsKey = JSON.stringify(ingot?.fields ?? null);
  const igOrderKey = JSON.stringify(ingot?.defaultOrder ?? null);
  const ingotFetcher = useMemo(
    () => (ingot ? createIngotTableFetcher<T>(ingot) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [igFetchPage, igIncludeKey, igFieldsKey, igOrderKey]
  );
  const fetchData = fetchDataProp ?? loopbackFetcher ?? ingotFetcher;
  const apiShortcut = Boolean(loopback || ingot);
  const paginationMode: TableMode = apiShortcut ? 'api' : paginationModeProp;
  const orderingMode: TableMode = apiShortcut ? 'api' : orderingModeProp;

  // Default `getRowId` to `row.id` (cast to string). Most rows in this app
  // expose a top-level `id`; callers with non-standard shapes can override.
  const getRowId = useMemo<(row: T) => string>(
    () => getRowIdProp ?? ((row: T) => String((row as { id?: unknown })?.id ?? '')),
    [getRowIdProp]
  );

  // Default to the LoopBack `where` evaluator so a multifilter wired against
  // a LoopBack API also works in local mode without any extra code. Callers
  // override (or compose) by passing `localMatch`.
  const localMatch = localMatchProp ?? matchLoopbackWhere;

  const { slice, fullId, patch } = useEasyVisionSlice<'table'>('table', id, {
    init: () => ({
      kind: 'table',
      page: 1,
      itemsPerPage: itemsPerPageProp,
      sort: null,
      selection: {
        ids: {},
        scope: selectAllScope === 'all' ? 'all' : 'page',
      },
      // Visibility starts empty: defaults from `initiallyHidden` are merged in
      // at read time, so columns added later still honor their declared default.
      columnVisibility: {},
      columnSizing: {},
    }),
    persist,
  });

  const { page, itemsPerPage, sort, selection } = slice;

  // Multifilter snapshot — held in a ref so refetches don't depend on its identity.
  const lastSnapshotRef = useRef<MultifilterSnapshot | null>(null);
  // Tick bumped on every confirmed multifilter perform. Used as a useMemo dep
  // to re-evaluate local-mode filtering without making the snapshot itself
  // part of any other reactive surface.
  const [localFilterTick, setLocalFilterTick] = useState(0);
  const innerMultifilterRef = useRef<MultifilterHandle | null>(null);
  const setMultifilterRef = useCallback(
    (handle: MultifilterHandle | null) => {
      innerMultifilterRef.current = handle;
      if (typeof multifilterRef === 'function') {
        multifilterRef(handle);
      } else if (multifilterRef && 'current' in multifilterRef) {
        (multifilterRef as { current: MultifilterHandle | null }).current = handle;
      }
    },
    [multifilterRef]
  );

  // API mode state.
  const [apiRows, setApiRows] = useState<T[]>([]);
  const [apiTotalCount, setApiTotalCount] = useState(0);
  const [apiLoading, setApiLoading] = useState(false);
  const fetchSeqRef = useRef(0);

  const isApi = paginationMode === 'api' || orderingMode === 'api';

  // Eager wildcard resolution: holds the materialized id list captured the
  // moment the user enters scope='all'. Reset on filter change / refetch /
  // leaving 'all'. Only used when `selectAllResolution === 'eager'` and api.
  const [eagerAllIds, setEagerAllIds] = useState<string[] | null>(null);
  const [eagerAllRows, setEagerAllRows] = useState<T[]>([]);
  const [isResolvingEager, setIsResolvingEager] = useState(false);
  const eagerSeqRef = useRef(0);

  const runFetch = useCallback(async () => {
    if (!fetchData) return;
    const seq = ++fetchSeqRef.current;
    setApiLoading(true);
    try {
      const merged = mergeFilters(externalFilter, lastSnapshotRef.current?.query);
      const result = await fetchData({
        page,
        itemsPerPage,
        sort,
        filter: merged,
      });
      if (seq !== fetchSeqRef.current) return;
      setApiRows(result.rows);
      setApiTotalCount(result.totalCount);
      onDataLoaded?.(result.rows, result.totalCount);
    } finally {
      if (seq === fetchSeqRef.current) setApiLoading(false);
    }
  }, [fetchData, page, itemsPerPage, sort, externalFilter, onDataLoaded]);

  useEffect(() => {
    if (!isApi || !fetchData) return;
    // A bound multifilter that opens with values (persisted, `defaultValue`s,
    // a default saved query) performs on mount one microtask later, and that
    // perform fetches. Queue behind it and skip if it already did: otherwise
    // the table first loads unfiltered and flashes every row.
    const seq = fetchSeqRef.current;
    queueMicrotask(() => {
      if (fetchSeqRef.current === seq) void runFetch();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApi, page, itemsPerPage, sort, refetchSignal, reloadSignal]);

  // Eager wildcard resolution: paginate fetchData to capture every matching id.
  // Uses the same merged filter as `runFetch`; sort follows the table's current
  // sort so the captured order matches what the user just saw.
  const resolveEagerAll = useCallback(async () => {
    if (!fetchData) return;
    const collectRows = selectAllResolution === 'eager';
    const seq = ++eagerSeqRef.current;
    setIsResolvingEager(true);
    try {
      const fetched = await fetchAllRows<T>({
        fetchData,
        filter: mergeFilters(externalFilter, lastSnapshotRef.current?.query),
        sort,
        idsOnly: !collectRows,
        shouldContinue: () => seq === eagerSeqRef.current,
      });
      if (fetched === null || seq !== eagerSeqRef.current) return;

      const ids: string[] = [];
      const rowsAcc: T[] = [];
      for (const row of fetched) {
        const rid = getRowId(row);
        if (rid) {
          ids.push(rid);
          if (collectRows) rowsAcc.push(row);
        }
      }
      setEagerAllIds(ids);
      if (collectRows) setEagerAllRows(rowsAcc);
    } finally {
      if (seq === eagerSeqRef.current) setIsResolvingEager(false);
    }
  }, [fetchData, externalFilter, sort, getRowId, selectAllResolution]);

  // refetchSignal also resets page to 1 (mirrors multifilter Buscar semantics).
  const prevRefetchRef = useRef(refetchSignal);
  useEffect(() => {
    if (prevRefetchRef.current !== refetchSignal && page !== 1) {
      prevRefetchRef.current = refetchSignal;
      patch({ page: 1 });
    } else {
      prevRefetchRef.current = refetchSignal;
    }
    // Eager mode: invalidate the cached id set on any external refetch.
    setEagerAllIds(null);
    setEagerAllRows([]);
    eagerSeqRef.current++;
    setIsResolvingEager(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchSignal]);

  // Local mode data computation.
  // Apply the multifilter / external `where` clause via `localMatch` before
  // sort + slice, so a multifilter wired with `paginationMode='local'` filters
  // the in-memory dataset with the same DSL as the API path.
  const filteredData = useMemo<T[] | undefined>(() => {
    if (paginationMode !== 'local') return data;
    if (!data || data.length === 0) return data;
    const mfWhere = lastSnapshotRef.current?.query?.where;
    const extWhere = externalFilter?.where;
    const merged: Record<string, unknown> | undefined =
      extWhere || mfWhere ? { ...(extWhere ?? {}), ...(mfWhere ?? {}) } : undefined;
    if (!merged || Object.keys(merged).length === 0) return data;
    return data.filter((row) => localMatch(row, merged));
    // localFilterTick is intentionally a dep: it bumps on perform so the
    // memo recomputes against the freshly-stored snapshot ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, paginationMode, localMatch, localFilterTick, externalFilter]);

  const local = useTableData<T>({
    data: filteredData,
    columns,
    page,
    itemsPerPage,
    sort,
    paginationMode,
    orderingMode,
  });

  const rows = isApi ? apiRows : local.rows;
  const totalCount = isApi ? apiTotalCount : local.totalCount;
  const isLoading = isLoadingProp || apiLoading;

  // Adapted TanStack columns.
  const cellCacheRef = useRef<CellCache>(new Map());
  const tanstackColumns = useMemo<ColumnDef<T>[]>(
    () =>
      adaptColumns(
        // Export-only columns are written to files, never drawn.
        columns.filter((c) => !c.exportOnly),
        orderingMode,
        defaultSorting,
        cellCacheRef.current
      ),
    [columns, orderingMode, defaultSorting]
  );

  // Build the visible columns (with optional checkbox column prepended).
  const allColumns = useMemo<ColumnDef<T>[]>(() => {
    if (!enableRowSelection) return tanstackColumns;
    const checkboxCol: ColumnDef<T> = {
      id: '_select',
      header: () => null, // we render our own header in the header row below
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          aria-label={
            getRowLabel ? `${labels.selectRow} ${getRowLabel(row.original)}` : labels.selectRow
          }
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [checkboxCol, ...tanstackColumns];
  }, [enableRowSelection, tanstackColumns]);

  // Column visibility / sizing both live in the table slice so they survive
  // unmount when `persist` is on (same lifetime as page / sort / selection).
  // The defaults merge is shared with the export path via `columnVisibility.ts`
  // so an export sees exactly the columns the table renders.
  const columnVisibility = useMemo<VisibilityState>(
    () => resolveColumnVisibility(columns, slice.columnVisibility),
    [columns, slice.columnVisibility]
  );

  // `columnFit: 'hide'`: a table that runs out of width hides columns by
  // priority instead of scrolling (`fitColumns` decides; here we measure).
  // The widest each column has painted is cached and pinned on its header,
  // so a column does not jump with every page's longest text. What the fit
  // hides is screen state only: it never reaches the slice's visibility, the
  // column menu's ticks or the export.
  const fitByHiding = columnFit === 'hide';
  const scrollRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef(new Map<string, number>());
  const [pinned, setPinned] = useState<Record<string, number>>({});
  const [autoHidden, setAutoHidden] = useState<ReadonlySet<string>>(NO_AUTO_HIDDEN);
  // The observer only wakes the measuring: a window resize renders nothing.
  const [measureTick, setMeasureTick] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!fitByHiding || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setMeasureTick((t) => (t + 1) % 1024));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitByHiding]);
  useLayoutEffect(() => {
    if (!fitByHiding) return;
    const container = scrollRef.current;
    const available = container?.clientWidth ?? 0;
    // Nothing measured (jsdom, display:none): never hide blindly.
    if (!container || available === 0) return;
    const declared = new Set(
      columns.filter((c) => c.width != null || c.resizable).map((c) => c.field)
    );
    if (measureWidest(container, declared, widthsRef.current)) {
      setPinned(Object.fromEntries(widthsRef.current));
    }
    const chosen = columns.filter((c) => !c.exportOnly && isColumnVisible(columnVisibility, c.field));
    const fit = fitColumns(
      [
        ...(enableRowSelection
          ? [
              {
                id: '_select',
                width: widthsRef.current.get('_select') ?? 36,
                priority: Infinity,
                essential: true,
                hidden: false,
              },
            ]
          : []),
        ...chosen.map((c, index) => ({
          id: c.field,
          width: Math.min(widthsRef.current.get(c.field) ?? 0, c.minWidth ?? Infinity),
          // Undeclared: right to left. One that started hidden and someone
          // switched on in the menu outranks every other — last in the queue,
          // it would never show and the menu would only say «sin sitio».
          priority:
            (c.priority ?? -index) +
            (c.initiallyHidden && slice.columnVisibility[c.field] === true ? ASKED_FOR : 0),
          essential: index === 0 || c.header === '' || c.header == null,
          hidden: autoHidden.has(c.field),
        })),
      ],
      available
    );
    const next = new Set(chosen.map((c) => c.field).filter((f) => !fit.has(f)));
    setAutoHidden((current) => (sameSet(current, next) ? current : next));
    // measureTick is the observer's alarm; rows re-measure every page.
  }, [
    fitByHiding,
    columns,
    columnVisibility,
    slice.columnVisibility,
    autoHidden,
    rows,
    measureTick,
    enableRowSelection,
  ]);
  // What TanStack draws: the person's choice minus what did not fit.
  const drawnVisibility = useMemo<VisibilityState>(() => {
    if (autoHidden.size === 0) return columnVisibility;
    const drawn = { ...columnVisibility };
    for (const field of autoHidden) drawn[field] = false;
    return drawn;
  }, [columnVisibility, autoHidden]);

  // Export wiring. Everything the export needs is read through this ref at
  // export time rather than captured at registration time, so a column toggle,
  // a new multifilter query, or a fresh fetcher identity all take effect
  // without re-registering.
  const exportStateRef = useRef({
    columns,
    columnVisibility,
    selection,
    fetchData,
    externalFilter,
    sort,
    filteredData,
    isApi,
    getRowId,
  });
  exportStateRef.current = {
    columns,
    columnVisibility,
    selection,
    fetchData,
    externalFilter,
    sort,
    filteredData,
    isApi,
    getRowId,
  };

  useEffect(() => {
    registerExportSource(fullId, {
      sheetName: id,
      getColumns: () => {
        const state = exportStateRef.current;
        return toExportColumns(state.columns, (field) =>
          isColumnVisible(state.columnVisibility, field)
        );
      },
      getRows: async () => {
        const state = exportStateRef.current;
        let all: T[];
        if (state.isApi && state.fetchData) {
          all =
            (await fetchAllRows<T>({
              fetchData: state.fetchData,
              filter: mergeFilters(
                state.externalFilter,
                lastSnapshotRef.current?.query
              ),
              sort: state.sort,
            })) ?? [];
        } else {
          // Local mode already holds the filtered set in memory, but not
          // sorted — sorting happens downstream in `useTableData` for the
          // rendered table, so apply the same active sort here.
          all = sortLocalRows(state.filteredData ?? [], state.columns, state.sort);
        }
        return applySelection(all, state.selection, state.getRowId);
      },
    });
    return () => unregisterExportSource(fullId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullId, id]);

  // Sizing: only persisted for columns currently marked `resizable: true`.
  // Drag events from TanStack arrive only for resizable columns anyway, but
  // we filter on write as well so a column toggling off `resizable` later
  // doesn't leave a stale width entry in the slice.
  const resizableFields = useMemo(() => {
    const s = new Set<string>();
    for (const c of columns) if (c.resizable) s.add(c.field);
    return s;
  }, [columns]);
  const columnSizing = slice.columnSizing;

  // Selection mapped into TanStack's RowSelectionState shape.
  const rowSelection = useMemo(() => {
    if (selection.scope === 'all') return {} as Record<string, boolean>;
    const r: Record<string, boolean> = {};
    for (const id of Object.keys(selection.ids)) r[id] = true;
    return r;
  }, [selection]);

  // With no sort chosen, the server's default order is the one shown: its
  // column carries the arrow, as it is what the rows are sorted by.
  const shownSort = sort ?? defaultSort ?? null;
  const sortingState: SortingState = shownSort
    ? [{ id: shownSort.column, desc: shownSort.descending }]
    : [];
  const isDefaultSort = (s: { column: string; descending: boolean } | null) =>
    !!s &&
    !!defaultSort &&
    s.column === defaultSort.column &&
    s.descending === defaultSort.descending;

  const isEagerWildcard =
    (selectAllResolution === 'eager' || selectAllResolution === 'eager-ids') &&
    isApi &&
    selection.scope === 'all';

  const tableInstance = useReactTable<T>({
    data: rows,
    columns: allColumns,
    state: {
      columnVisibility: drawnVisibility,
      columnSizing,
      ...(enableRowSelection ? { rowSelection } : {}),
      sorting: sortingState,
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(columnVisibility) : updater;
      patch({ columnVisibility: next } as Partial<TableSliceData>);
    },
    onColumnSizingChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: ColumnSizingState) => ColumnSizingState)(columnSizing)
          : updater;
      // Strip non-resizable keys so the slice doesn't accumulate stale entries
      // for columns that later drop `resizable: true`.
      const filtered: Record<string, number> = {};
      for (const k in next) {
        if (resizableFields.has(k)) filtered[k] = next[k];
      }
      patch({ columnSizing: filtered } as Partial<TableSliceData>);
    },
    enableRowSelection,
    onRowSelectionChange: enableRowSelection
      ? (updater) => {
          const next =
            typeof updater === 'function' ? updater(rowSelection) : updater;
          const ids: Record<string, true> = {};
          for (const k of Object.keys(next)) {
            if (next[k]) ids[k] = true;
          }
          patch({ selection: { ...selection, ids } });
        }
      : undefined,
    onSortingChange: (updater) => {
      // Eager wildcard: lock sort while a materialized 'all' selection is
      // active — otherwise the captured id order would silently desync from
      // the rendered view.
      if (isEagerWildcard) return;
      const next =
        typeof updater === 'function' ? updater(sortingState) : updater;
      const first = next[0];
      let newSort = first ? { column: first.id, descending: !!first.desc } : null;
      // Leaving the default column unsorted would show it sorted again, so a
      // click on it turns it around instead; and landing on the default is
      // the same as choosing nothing.
      if (!newSort && sort === null && defaultSort) {
        newSort = { column: defaultSort.column, descending: !defaultSort.descending };
      } else if (isDefaultSort(newSort)) {
        newSort = null;
      }
      patch({ sort: newSort } as Partial<TableSliceData>);
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    // TanStack picks the first sort direction per column by sniffing row 0 of
    // the *current* page (`getAutoSortDir`: string → asc, anything else → desc).
    // With server-side data that row changes between clicks, so the asc/desc/off
    // cycle collapses — e.g. a nullable date column whose page-1 ASC result leads
    // with a null row flips firstSortDir to 'desc' and the next click removes the
    // sort instead of going descending. Pin it so the cycle is always off → asc
    // → desc → off, on every page.
    sortDescFirst: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    pageCount: Math.ceil(totalCount / itemsPerPage),
    getRowId,
  });

  // Selection change emission.
  const lastSelectionEmittedRef = useRef<string>('');
  useEffect(() => {
    if (!enableRowSelection) return;
    // While we're materializing the eager id list, suppress emissions so the
    // host doesn't see a transient empty/wildcard event before the resolution.
    if (isEagerWildcard && (isResolvingEager || eagerAllIds === null)) return;
    let event: SelectionChange<T>;
    if (selection.scope === 'all') {
      if (paginationMode === 'local') {
        // In local mode "all" means everything that passes the active filter,
        // not the raw input dataset.
        const allRows = filteredData ?? data ?? [];
        const ids = allRows.map(getRowId).filter(Boolean);
        event = { scope: 'all', mode: 'in-memory', ids, rows: allRows };
      } else if (selectAllResolution === 'eager' && eagerAllIds) {
        // Eager api wildcard: emit the materialized id+row set, minus unticks.
        const exceptSet = new Set(Object.keys(selection.exceptIds ?? {}));
        let ids: string[];
        let outRows: T[];
        if (exceptSet.size) {
          ids = [];
          outRows = [];
          for (let i = 0; i < eagerAllIds.length; i++) {
            const rid = eagerAllIds[i];
            if (exceptSet.has(rid)) continue;
            ids.push(rid);
            const r = eagerAllRows[i];
            if (r !== undefined) outRows.push(r);
          }
        } else {
          ids = eagerAllIds;
          outRows = eagerAllRows;
        }
        event = { scope: 'all', mode: 'in-memory', ids, rows: outRows };
      } else if (selectAllResolution === 'eager-ids' && eagerAllIds) {
        // Eager api wildcard, ids-only: emit the materialized id set, minus unticks.
        // No rows field — caller cannot accidentally read row data that wasn't materialized.
        const exceptSet = new Set(Object.keys(selection.exceptIds ?? {}));
        let ids: string[];
        if (exceptSet.size) {
          ids = [];
          for (const rid of eagerAllIds) {
            if (exceptSet.has(rid)) continue;
            ids.push(rid);
          }
        } else {
          ids = eagerAllIds;
        }
        event = { scope: 'all', mode: 'in-memory-ids', ids };
      } else {
        const exceptIds = Object.keys(selection.exceptIds ?? {});
        const exceptSet = new Set(exceptIds);
        const pageRows = rows.filter((r) => !exceptSet.has(getRowId(r)));
        const ids = pageRows.map(getRowId).filter(Boolean);
        event = {
          scope: 'all',
          mode: 'wildcard',
          ids,
          exceptIds,
          rows: pageRows,
        };
      }
    } else {
      const ids = Object.keys(selection.ids);
      const idSet = new Set(ids);
      const selectedRows = rows.filter((r) => idSet.has(getRowId(r)));
      event = { scope: 'page', ids, rows: selectedRows };
    }
    const key = JSON.stringify({
      ...event,
      rows: 'rows' in event ? event.rows.length : 0,
    });
    if (key === lastSelectionEmittedRef.current) return;
    lastSelectionEmittedRef.current = key;
    onSelectionChange?.(event);
  }, [
    enableRowSelection,
    selection,
    paginationMode,
    data,
    filteredData,
    rows,
    getRowId,
    onSelectionChange,
    selectAllResolution,
    eagerAllIds,
    eagerAllRows,
    isResolvingEager,
    isEagerWildcard,
  ]);

  // Row id resolution helper.
  const rowIdOf = useCallback(
    (row: T): string => getRowId(row),
    [getRowId]
  );

  // Header checkbox state.
  const headerState: 'unchecked' | 'indeterminate' | 'checked' = useMemo(() => {
    if (selection.scope === 'all') {
      const except = Object.keys(selection.exceptIds ?? {}).length;
      if (except === 0) return 'checked';
      return 'indeterminate';
    }
    const visibleIds = rows.map(rowIdOf).filter(Boolean);
    if (visibleIds.length === 0) return 'unchecked';
    let selectedOnPage = 0;
    for (const id of visibleIds) {
      if (selection.ids[id]) selectedOnPage++;
    }
    if (selectedOnPage === 0) return 'unchecked';
    if (selectedOnPage === visibleIds.length) return 'checked';
    return 'indeterminate';
  }, [selection, rows, rowIdOf]);

  const onHeaderToggle = useCallback(
    (checked: boolean) => {
      if (selection.scope === 'all') {
        if (checked) {
          patch({ selection: { ids: {}, scope: 'all', exceptIds: {} } });
        } else {
          // Mark every loaded row as excepted.
          const exceptIds: Record<string, true> = { ...(selection.exceptIds ?? {}) };
          for (const r of rows) {
            const rid = rowIdOf(r);
            if (rid) exceptIds[rid] = true;
          }
          patch({ selection: { ...selection, exceptIds } });
        }
        return;
      }
      // page scope: toggle visible rows.
      const next: Record<string, true> = { ...selection.ids };
      const visibleIds = rows.map(rowIdOf).filter(Boolean);
      if (checked) {
        for (const rid of visibleIds) next[rid] = true;
      } else {
        for (const rid of visibleIds) delete next[rid];
      }
      patch({ selection: { ...selection, ids: next } });
    },
    [patch, selection, rows, rowIdOf]
  );

  const onScopeChange = useCallback(
    (scope: 'page' | 'all') => {
      if (scope === 'all') {
        patch({ selection: { ids: {}, scope: 'all', exceptIds: {} } });
        if (
          (selectAllResolution === 'eager' || selectAllResolution === 'eager-ids') &&
          isApi
        ) {
          setEagerAllIds(null);
          setEagerAllRows([]);
          void resolveEagerAll();
        }
      } else {
        patch({ selection: { ids: {}, scope: 'page' } });
        setEagerAllIds(null);
        setEagerAllRows([]);
        eagerSeqRef.current++; // cancel any in-flight resolution
        setIsResolvingEager(false);
      }
    },
    [patch, selectAllResolution, isApi, resolveEagerAll]
  );

  // Multifilter perform → reset page, store snapshot, refetch.
  // Exception: the very first perform after mount is the multifilter's
  // auto-emission of its (possibly persisted) confirmed state. We must NOT
  // reset page in that case, otherwise navigating away from a filtered
  // table on page 3 and back lands the user on page 1.
  const firstPerformAfterMountRef = useRef(true);
  const handlePerform = useCallback(
    (snap: MultifilterSnapshot) => {
      const isFirstAfterMount = firstPerformAfterMountRef.current;
      firstPerformAfterMountRef.current = false;
      lastSnapshotRef.current = snap;
      // Clear stale 'all' selection on filter change.
      if (selection.scope === 'all') {
        patch({ selection: { ids: {}, scope: 'all', exceptIds: {} } });
      }
      // Eager mode: invalidate the cached id set whenever the filter changes.
      // The next entry into 'all' scope will re-materialize.
      setEagerAllIds(null);
      setEagerAllRows([]);
      eagerSeqRef.current++;
      setIsResolvingEager(false);
      if (!isFirstAfterMount) patch({ page: 1 });
      multifilter?.onPerform?.(snap);
      if (isApi) void runFetch();
      else setLocalFilterTick((n) => n + 1);
    },
    [isApi, multifilter, patch, runFetch, selection.scope]
  );

  // Set page bounds (api totalCount may shrink).
  // Skip clamping while an API fetch is in flight or hasn't run yet — on
  // remount with persisted state, apiTotalCount is 0 until the first fetch
  // resolves, which would otherwise clobber a restored page > 1.
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const hasResolvedDataRef = useRef(false);
  useEffect(() => {
    if (isApi) {
      if (apiLoading) return;
      if (!hasResolvedDataRef.current) {
        // First fetch hasn't completed yet; defer clamping.
        if (apiTotalCount > 0 || apiRows.length > 0) {
          hasResolvedDataRef.current = true;
        } else {
          return;
        }
      }
    }
    if (page > totalPages) patch({ page: totalPages });
  }, [page, totalPages, patch, isApi, apiLoading, apiTotalCount, apiRows.length]);

  // Reset page when rows count changes from local data filter.
  useEffect(() => {
    if (isApi) return;
    if (paginationMode === 'page' as never) return;
    if (page > 1 && page > Math.max(1, Math.ceil(totalCount / itemsPerPage))) {
      patch({ page: 1 });
    }
  }, [totalCount, itemsPerPage, page, paginationMode, patch, isApi]);

  return (
    <NamespaceProvider fullId={fullId}>
      <div className={className}>
        {multifilter && (
          <div className="ev-table-multifilter">
            <EasyVisionMultifilter
              {...multifilter}
              performMode={
                multifilter.performMode === undefined ||
                multifilter.performMode === 'auto'
                  ? isApi
                    ? 'manual'
                    : 'live'
                  : multifilter.performMode
              }
              ref={setMultifilterRef}
              onPerform={handlePerform}
            />
          </div>
        )}

        <div className="ev-table-card">
          {(toolbarLeft || toolbarRight || enableRowSelection || showColumnVisibility) && (
            <div className="ev-table-toolbar">
              <div className="ev-table-toolbar-section">{toolbarLeft}</div>
              

              {enableRowSelection && (() => {
          const isAllScope = selection.scope === 'all';
          const pageCount = isAllScope ? 0 : Object.keys(selection.ids ?? {}).length;
          // In eager api mode, the materialized list (minus unticks) is the
          // authoritative count — fall back to totalCount-exceptIds otherwise.
          const eagerCount =
            isEagerWildcard && eagerAllIds
              ? Math.max(
                  0,
                  eagerAllIds.length -
                    Object.keys(selection.exceptIds ?? {}).length
                )
              : null;
          const allCount = isAllScope
            ? eagerCount ?? Math.max(0, totalCount - Object.keys(selection.exceptIds ?? {}).length)
            : 0;
          if (!isAllScope && pageCount === 0) return null;
          return (
            <div className="ev-table-sel-banner">
              {isEagerWildcard && isResolvingEager && (
                <Loader2 className="ev-table-sel-banner-spinner" />
              )}
              <span className="ev-table-sel-banner-text">
                {isAllScope
                  ? isEagerWildcard && isResolvingEager
                    ? `${labels.loading}…`
                    : labels.selectedAllBanner(allCount)
                  : labels.selectedCountBanner(pageCount)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onScopeChange('page')}
                className="ev-table-clear-btn"
              >
                <X className="ev-table-clear-icon" />
                {labels.clearSelection}
              </Button>
            </div>
          );
        })()}

              <div className="ev-table-toolbar-section">
                {toolbarRight}
                {showColumnVisibility && (
                  <ColumnVisibilityMenu
                    table={tableInstance}
                    label={labels.customizeColumns}
                    chosen={columnVisibility}
                    autoHidden={autoHidden}
                    noRoom={labels.noRoom}
                  />
                )}
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className="easyvision-table-scroll"
            style={
              maxBodyHeight !== undefined
                ? {
                    maxHeight:
                      typeof maxBodyHeight === 'number'
                        ? `${maxBodyHeight}px`
                        : maxBodyHeight,
                  }
                : undefined
            }
          >
            <table
              className={fitByHiding ? 'ev-table ev-table-fit' : 'ev-table'}
              aria-label={ariaLabel}
            >
            <TableHeader
              className={
                maxBodyHeight !== undefined ? 'ev-table-thead-sticky' : undefined
              }
            >
              {tableInstance.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    if (header.column.id === '_select' && enableRowSelection) {
                      return (
                        <TableHead key={header.id} className="ev-table-th-checkbox" data-field="_select">
                          <SelectAllControl
                            scope={selection.scope}
                            toggleable={selectAllScope === 'toggleable'}
                            state={headerState}
                            onToggle={onHeaderToggle}
                            onScopeChange={onScopeChange}
                            labels={{
                              selectAllPage: labels.selectAllPage,
                              selectAllAll: labels.selectAllAll,
                            }}
                          />
                        </TableHead>
                      );
                    }
                    const colDef = columns.find(
                      (c) => c.field === header.column.id
                    );
                    const sortable =
                      colDef && !shouldDisableSorting(colDef, orderingMode, defaultSorting) && !isEagerWildcard;
                    const colMeta = (header.column.columnDef.meta ?? {}) as {
                      largeScreensOnly?: boolean;
                      width?: string;
                      resizable?: boolean;
                      minWidth?: number;
                    };
                    // Resizable columns get a live width from TanStack; static
                    // `width` columns get the configured CSS value as-is.
                    const headerWidthStyle: React.CSSProperties | undefined =
                      colMeta.resizable
                        ? { width: header.getSize(), minWidth: header.getSize() }
                        : colMeta.width
                        ? { width: colMeta.width, minWidth: colMeta.width }
                        : colMeta.minWidth
                        ? { minWidth: colMeta.minWidth }
                        : fitByHiding && pinned[header.column.id]
                        ? { width: pinned[header.column.id] }
                        : undefined;
                    return (
                      <TableHead
                        key={header.id}
                        data-field={header.column.id}
                        style={headerWidthStyle}
                        aria-sort={
                          header.column.getIsSorted() === 'asc'
                            ? 'ascending'
                            : header.column.getIsSorted() === 'desc'
                            ? 'descending'
                            : undefined
                        }
                        className={
                          [
                            colMeta.largeScreensOnly ? 'ev-table-large-only' : '',
                            colMeta.minWidth ? 'ev-table-wrap' : '',
                          ]
                            .filter(Boolean)
                            .join(' ') || undefined
                        }
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            className="ev-table-sort-btn"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' ? (
                              <ArrowUp className="ev-table-sort-icon" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ArrowDown className="ev-table-sort-icon" />
                            ) : (
                              <ArrowUpDown className="ev-table-sort-icon ev-table-sort-icon-inactive" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {colMeta.resizable && header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize column"
                            // Wide invisible hit-target so users don't need
                            // pixel-perfect aim. The visible line is drawn
                            // via ::after and styled per state in CSS.
                            className={[
                              'ev-resize-handle',
                              header.column.getIsResizing() ? 'is-resizing' : '',
                            ].filter(Boolean).join(' ')}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={allColumns.length} className="ev-table-empty-cell">
                    <div className="ev-table-spinner-wrapper">
                      <Loader2 className="ev-table-loading-spinner" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : tableInstance.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={allColumns.length} className="ev-table-empty-cell">
                    <div className="ev-table-empty-state">
                      <p className="ev-table-empty-text">
                        {emptyMessage ?? labels.noData}
                      </p>
                      {emptyAction}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tableInstance.getRowModel().rows.map((row) => {
                  const rid = rowIdOf(row.original);
                  // For 'all' scope rows are conceptually selected unless excepted.
                  const isAllSelected =
                    selection.scope === 'all' && !selection.exceptIds?.[rid];
                  const highlighted = isRowHighlighted?.(row.original) ?? false;
                  return (
                    <React.Fragment key={row.id}>
                    <TableRow
                      key={row.id}
                      data-state={
                        (row.getIsSelected() || isAllSelected) ? 'selected' : undefined
                      }
                      data-highlighted={highlighted ? 'true' : undefined}
                      className={onRowClick ? 'ev-table-row-clickable' : undefined}
                      onClick={(e) => {
                        if (onRowClick && !isFromWithinControl(e)) onRowClick(row.original);
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        if (cell.column.id === '_select' && selection.scope === 'all') {
                          return (
                            <TableCell key={cell.id}>
                              <Checkbox
                                checked={!selection.exceptIds?.[rid]}
                                onCheckedChange={(v) => {
                                  const exceptIds = { ...(selection.exceptIds ?? {}) };
                                  if (v) delete exceptIds[rid];
                                  else exceptIds[rid] = true;
                                  patch({ selection: { ...selection, exceptIds } });
                                }}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                              />
                            </TableCell>
                          );
                        }
                        const cellMeta = (cell.column.columnDef.meta ?? {}) as {
                          largeScreensOnly?: boolean;
                          width?: string;
                          truncate?: boolean;
                          resizable?: boolean;
                          minWidth?: number;
                          tooltip?: (row: T) => string | undefined;
                        };
                        const cellWidthStyle: React.CSSProperties | undefined =
                          cellMeta.resizable
                            ? { width: cell.column.getSize(), minWidth: cell.column.getSize() }
                            : cellMeta.width
                            ? { width: cellMeta.width, minWidth: cellMeta.width }
                            : undefined;
                        const rendered = flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        );
                        // For columns with a value (not `type:'ui'`) expose the
                        // raw value as a native tooltip so truncated content
                        // stays discoverable. For custom cells whose accessor
                        // returns a non-string, we just skip the tooltip.
                        let titleAttr: string | undefined;
                        if (cellMeta.truncate && cellMeta.tooltip) {
                          titleAttr = cellMeta.tooltip(row.original);
                        } else if (cellMeta.truncate) {
                          try {
                            const raw = cell.getValue();
                            if (raw != null && (typeof raw === 'string' || typeof raw === 'number')) {
                              const s = String(raw);
                              if (s) titleAttr = s;
                            }
                          } catch {
                            // ui columns or accessors that throw — ignore.
                          }
                        }
                        return (
                          <TableCell
                            key={cell.id}
                            style={cellWidthStyle}
                            className={[
                              cellMeta.largeScreensOnly ? 'ev-table-large-only' : '',
                              cellMeta.truncate ? 'ev-table-cell-truncate' : '',
                              cellMeta.minWidth ? 'ev-table-wrap' : '',
                            ].filter(Boolean).join(' ') || undefined}
                          >
                            {cellMeta.truncate && cellMeta.tooltip ? (
                              titleAttr ? (
                                <Tooltip>
                                  <TooltipTrigger
                                    delay={300}
                                    className="ev-table-cell-truncate-inner"
                                    tabIndex={0}
                                    aria-description={titleAttr}
                                    render={<div />}
                                  >
                                    {rendered}
                                  </TooltipTrigger>
                                  <TooltipContent side="top" style={{ maxWidth: 420 }}>
                                    {titleAttr}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <div className="ev-table-cell-truncate-inner">{rendered}</div>
                              )
                            ) : cellMeta.truncate ? (
                              <div
                                className="ev-table-cell-truncate-inner"
                                title={titleAttr}
                              >
                                {rendered}
                              </div>
                            ) : cellMeta.minWidth ? (
                              // Width 0 that fills the cell: what is inside no
                              // longer widens the column; it wraps instead.
                              <div className="ev-table-wrap-fill">{rendered}</div>
                            ) : (
                              rendered
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {renderDetail && expandedIds?.includes(rid) && (
                      // What does not fit in a cell (a text to read) gets a row
                      // of its own, full width, rendered only while open.
                      <TableRow
                        id={getDetailId ? getDetailId(rid) : `${rid}-detail`}
                        data-detail
                        className="ev-table-detail-row"
                      >
                        <TableCell colSpan={tableInstance.getVisibleLeafColumns().length}>
                          {renderDetail(row.original)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                  );
                })
              )}
            </TableBody>
            </table>
          </div>

          {paginationDisplay !== 'fixedTotalItems' && (
            <PaginationFooter
              currentPage={page}
              totalCount={totalCount}
              itemsPerPage={itemsPerPage}
              itemsPerPageOptions={itemsPerPageOptions}
              onPageChange={(p) => patch({ page: p })}
              onItemsPerPageChange={(n) => patch({ itemsPerPage: n, page: 1 })}
              labels={labels}
              display={paginationDisplay}
            />
          )}
        </div>
      </div>
    </NamespaceProvider>
  );
}

const NO_AUTO_HIDDEN: ReadonlySet<string> = new Set();
/** A column the person switched on in the menu outranks any declared priority. */
const ASKED_FOR = 1_000_000;

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/**
 * Keeps in `widths` the widest each column has painted and says whether one
 * grew. Measured at NATURAL width: a table stretched to its container makes
 * its columns add up to exactly the space available, so «nothing else fits»
 * by construction and a hidden column never came back. `max-content`, not
 * `auto`: at `auto` a table that does not fit squeezes its wrapping cells. The
 * width pinned on a header is lifted to measure (unless the column declares
 * one), or a column would never grow past the first page. Everything is
 * restored before paint (called from a layout effect), so nothing flickers.
 */
function measureWidest(
  container: HTMLElement,
  declared: ReadonlySet<string>,
  widths: Map<string, number>
): boolean {
  const table = container.querySelector<HTMLTableElement>('table');
  if (!table) return false;
  const stretched = table.style.width;
  table.style.width = 'max-content';
  // An open row's detail spans every column: measured at max-content its text,
  // on one line, would widen them all, and the cache only grows.
  const details = [...table.querySelectorAll<HTMLElement>('tr[data-detail]')];
  for (const row of details) row.style.display = 'none';
  let grew = false;
  for (const th of table.querySelectorAll<HTMLElement>('th[data-field]')) {
    const field = th.dataset.field;
    if (!field) continue;
    const fixed = th.style.width;
    if (field !== '_select' && !declared.has(field)) th.style.width = '';
    const width = th.offsetWidth;
    th.style.width = fixed;
    if (width > (widths.get(field) ?? 0)) {
      widths.set(field, width);
      grew = true;
    }
  }
  for (const row of details) row.style.display = '';
  table.style.width = stretched;
  return grew;
}
