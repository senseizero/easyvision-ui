import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ColumnDef,
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
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import { NamespaceProvider } from '../store/NamespaceContext';
import { adaptColumns, shouldDisableSorting } from './ColumnDefAdapter';
import { useTableData } from './useTableData';
import { SelectAllControl } from './SelectAllControl';
import { PaginationFooter } from './PaginationFooter';
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu';
import { EasyVisionMultifilter, type MultifilterHandle } from '../multifilter/EasyVisionMultifilter';
import { createLoopbackTableFetcher, matchLoopbackWhere } from '../adapters/loopback';
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
};

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
    onDataLoaded,
    multifilter,
    multifilterRef,
    refetchSignal,
    externalFilter,
    localMatch: localMatchProp,
    getRowId: getRowIdProp,
    itemsPerPage: itemsPerPageProp = 10,
    itemsPerPageOptions = [10, 15, 20],
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
  const fetchData = fetchDataProp ?? loopbackFetcher;
  const paginationMode: TableMode = loopback ? 'api' : paginationModeProp;
  const orderingMode: TableMode = loopback ? 'api' : orderingModeProp;

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
      // Merge externally-driven filter (e.g. from a bespoke search panel) with
      // the multifilter snapshot's where, if both are present. The multifilter
      // wins on key collisions so it can override the external filter.
      const mfQuery = lastSnapshotRef.current?.query;
      const merged =
        externalFilter || mfQuery
          ? {
              ...mfQuery,
              where: {
                ...(externalFilter?.where ?? {}),
                ...(mfQuery?.where ?? {}),
              },
            }
          : undefined;
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
    if (isApi && fetchData) void runFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApi, page, itemsPerPage, sort, refetchSignal]);

  // Eager wildcard resolution: paginate fetchData to capture every matching id.
  // Uses the same merged filter as `runFetch`; sort follows the table's current
  // sort so the captured order matches what the user just saw.
  const resolveEagerAll = useCallback(async () => {
    if (!fetchData) return;
    const seq = ++eagerSeqRef.current;
    setIsResolvingEager(true);
    try {
      const mfQuery = lastSnapshotRef.current?.query;
      const merged =
        externalFilter || mfQuery
          ? {
              ...mfQuery,
              where: {
                ...(externalFilter?.where ?? {}),
                ...(mfQuery?.where ?? {}),
              },
            }
          : undefined;
      const PAGE_SIZE = 200;
      const ids: string[] = [];
      const rowsAcc: T[] = [];
      let knownTotal = Infinity;
      for (let p = 1; ids.length < knownTotal; p++) {
        const result = await fetchData({
          page: p,
          itemsPerPage: PAGE_SIZE,
          sort,
          filter: merged,
        });
        if (seq !== eagerSeqRef.current) return;
        knownTotal = result.totalCount;
        for (const row of result.rows) {
          const rid = getRowId(row);
          if (rid) {
            ids.push(rid);
            rowsAcc.push(row);
          }
        }
        if (result.rows.length < PAGE_SIZE) break;
      }
      if (seq !== eagerSeqRef.current) return;
      setEagerAllIds(ids);
      setEagerAllRows(rowsAcc);
    } finally {
      if (seq === eagerSeqRef.current) setIsResolvingEager(false);
    }
  }, [fetchData, externalFilter, sort, getRowId]);

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
  const tanstackColumns = useMemo<ColumnDef<T>[]>(
    () => adaptColumns(columns, orderingMode, defaultSorting),
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
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    };
    return [checkboxCol, ...tanstackColumns];
  }, [enableRowSelection, tanstackColumns]);

  // Initial column visibility from meta.initiallyHidden.
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    const v: VisibilityState = {};
    for (const c of columns) {
      if (c.initiallyHidden) v[c.field] = false;
    }
    return v;
  });

  // Selection mapped into TanStack's RowSelectionState shape.
  const rowSelection = useMemo(() => {
    if (selection.scope === 'all') return {} as Record<string, boolean>;
    const r: Record<string, boolean> = {};
    for (const id of Object.keys(selection.ids)) r[id] = true;
    return r;
  }, [selection]);

  const sortingState: SortingState = sort
    ? [{ id: sort.column, desc: sort.descending }]
    : [];

  const isEagerWildcard =
    selectAllResolution === 'eager' && isApi && selection.scope === 'all';

  const tableInstance = useReactTable<T>({
    data: rows,
    columns: allColumns,
    state: {
      columnVisibility,
      ...(enableRowSelection ? { rowSelection } : {}),
      sorting: sortingState,
    },
    onColumnVisibilityChange: setColumnVisibility,
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
      const newSort = first ? { column: first.id, descending: !!first.desc } : null;
      patch({ sort: newSort } as Partial<TableSliceData>);
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
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
    const key = JSON.stringify({ ...event, rows: event.rows.length });
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
        if (selectAllResolution === 'eager' && isApi) {
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
                  <ColumnVisibilityMenu table={tableInstance} label={labels.customizeColumns} />
                )}
              </div>
            </div>
          )}

          <div
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
            <table className="ev-table">
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
                        <TableHead key={header.id} className="ev-table-th-checkbox">
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
                    };
                    // Resizable columns get a live width from TanStack; static
                    // `width` columns get the configured CSS value as-is.
                    const headerWidthStyle: React.CSSProperties | undefined =
                      colMeta.resizable
                        ? { width: header.getSize(), minWidth: header.getSize() }
                        : colMeta.width
                        ? { width: colMeta.width, minWidth: colMeta.width }
                        : undefined;
                    return (
                      <TableHead
                        key={header.id}
                        style={headerWidthStyle}
                        className={
                          colMeta.largeScreensOnly ? 'ev-table-large-only' : undefined
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
                    <TableRow
                      key={row.id}
                      data-state={
                        (row.getIsSelected() || isAllSelected) ? 'selected' : undefined
                      }
                      data-highlighted={highlighted ? 'true' : undefined}
                      className={onRowClick ? 'ev-table-row-clickable' : undefined}
                      onClick={() => onRowClick?.(row.original)}
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
                        if (cellMeta.truncate) {
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
                            ].filter(Boolean).join(' ') || undefined}
                          >
                            {cellMeta.truncate ? (
                              <div
                                className="ev-table-cell-truncate-inner"
                                title={titleAttr}
                              >
                                {rendered}
                              </div>
                            ) : (
                              rendered
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            </table>
          </div>

          <PaginationFooter
            currentPage={page}
            totalCount={totalCount}
            itemsPerPage={itemsPerPage}
            itemsPerPageOptions={itemsPerPageOptions}
            onPageChange={(p) => patch({ page: p })}
            onItemsPerPageChange={(n) => patch({ itemsPerPage: n, page: 1 })}
            labels={labels}
          />
        </div>
      </div>
    </NamespaceProvider>
  );
}
