import type { ReactNode, Ref } from 'react';
import type { BaseStatefulProps } from './common.types';
import type {
  EasyVisionMultifilterProps,
  MultifilterHandle,
  MultifilterQuery,
} from './multifilter.types';
import type { CreateLoopbackTableFetcherOptions, LoopbackFilter } from '../adapters/loopback';

export type TableMode = 'local' | 'api';

/**
 * Controls the fallback sorting behavior when a column does not specify
 * `sortable` explicitly:
 *  - `'nonNested'` (default): flat fields sortable, nested (dot-path) fields not.
 *  - `'all'`: every data column sortable, including nested fields.
 *  - `'disabled'`: no data column sortable unless it sets `sortable: true`.
 *
 * Per-column `sortable: true | false` always wins over this default.
 */
export type DefaultSortingMode = 'disabled' | 'nonNested' | 'all';

/**
 * Column definition for EasyVisionTable.
 *
 * Two variants distinguished by `type`:
 *  - `data` (default): maps to a value in the row. `field` is the dot-path used
 *    for both the column ID and value extraction. Sortable by default for flat
 *    fields; nested fields require `sortable: true` to enable sorting.
 *  - `ui`: presentational column with no underlying value. `field` is just a
 *    unique ID. `cell` is required.
 *
 * `cell` receives the row item directly. When omitted on a `data` column, the
 * library renders the resolved value in a standard span.
 */
export type EasyVisionColumn<T> =
  | {
      type?: 'data';
      /** Dot-path to the value (e.g. `"client.name"`). Doubles as the column ID. */
      field: string;
      header: string | ReactNode | ((props: unknown) => ReactNode);
      /** Custom renderer. Receives the row item directly. Omit for default span. */
      cell?: (item: T) => ReactNode;
      /**
       * Force-enable or force-disable sorting. Defaults: flat fields → enabled,
       * nested fields → disabled (because most APIs don't support nested sort).
       */
      sortable?: boolean;
      initiallyHidden?: boolean;
      largeScreensOnly?: boolean;
      /**
       * Fixed column width. Number → pixels; string → any CSS width value
       * (`'200px'`, `'12rem'`, `'min-content'`). When unset, the column grows
       * to fit its content (the table uses `min-w-max`).
       */
      width?: number | string;
      /**
       * Clamp the cell content to a single line with an ellipsis. For the
       * default cell renderer the full text is also exposed via `title=` for
       * a native hover tooltip; for custom `cell` renderers, set your own
       * `title` if you want one.
       *
       * Combine with `width` (or `resizable`) to bound the column — without a
       * width, a `<table>` cell will still expand to fit, defeating truncation.
       */
      truncate?: boolean;
      /**
       * Allow the user to drag the column's right edge to resize it. The
       * starting width is `width` (or 240px if unset). User-resized widths are
       * kept in component state for the lifetime of the mount.
       */
      resizable?: boolean;
    }
  | {
      type: 'ui';
      /** Unique column ID. */
      field: string;
      header: string | ReactNode | ((props: unknown) => ReactNode);
      cell: (item: T) => ReactNode;
      initiallyHidden?: boolean;
      largeScreensOnly?: boolean;
      /** See data-column docs. */
      width?: number | string;
      /** See data-column docs. */
      truncate?: boolean;
      /** See data-column docs. */
      resizable?: boolean;
    };

export interface ApiFetchParams {
  page: number;
  itemsPerPage: number;
  sort: { column: string; descending: boolean } | null;
  /** Latest perform-confirmed multifilter query, when a multifilter is bound. */
  filter?: MultifilterQuery;
}

export interface ApiFetchResult<T> {
  rows: T[];
  totalCount: number;
}

export type SelectionChange<T = unknown> =
  | { scope: 'page'; ids: string[]; rows: T[] }
  | { scope: 'all'; mode: 'in-memory'; ids: string[]; rows: T[] }
  | { scope: 'all'; mode: 'wildcard'; ids: string[]; exceptIds: string[]; rows: T[] };

export interface TableLabels {
  rowsPerPage: string;
  results: string;
  page: string;
  of: string;
  noData: string;
  loading: string;
  customizeColumns: string;
  selectAllPage: string;
  selectAllAll: string;
  selectedAllBanner: (n: number) => string;
  selectedCountBanner: (n: number) => string;
  clearSelection: string;
}

export interface EasyVisionTableProps<T> extends BaseStatefulProps {
  columns: EasyVisionColumn<T>[];
  paginationMode?: TableMode;
  orderingMode?: TableMode;
  /**
   * Fallback sorting behavior for columns that don't set `sortable` explicitly.
   * Defaults to `'nonNested'`.
   */
  defaultSorting?: DefaultSortingMode;

  /** local mode: full dataset; the table slices it. */
  data?: T[];

  /** api mode: server-driven. */
  fetchData?: (params: ApiFetchParams) => Promise<ApiFetchResult<T>>;

  /**
   * Declarative shortcut for LoopBack-backed tables. When set, the table
   * builds its own `fetchData` via `createLoopbackTableFetcher` and forces
   * `paginationMode` / `orderingMode` to `'api'`. Mutually exclusive with
   * an explicit `fetchData`.
   *
   * @example
   *   <EasyVisionTable
   *     id="alerts"
   *     loopback={{
   *       fetchPage: fetchAlertsByFilter,
   *       fetchCount: countAlertsByFilter,
   *       include: [{ relation: 'client' }],
   *       fields: ALERT_FIELDS,
   *       defaultOrder: ['created DESC'],
   *     }}
   *     columns={columns}
   *   />
   */
  loopback?: CreateLoopbackTableFetcherOptions<T>;

  /**
   * Fires after each successful API fetch with the freshly loaded rows and total count.
   * Useful when the page needs to mirror the loaded slice into another store
   * (e.g. a global context for export/selection) without wrapping `fetchData`.
   */
  onDataLoaded?: (rows: T[], totalCount: number) => void;

  /** Declarative bound multifilter — auto-mounted in the toolbar. */
  multifilter?: EasyVisionMultifilterProps;
  /** Forwarded to the bound multifilter; lets callers call `perform()` programmatically. */
  multifilterRef?: Ref<MultifilterHandle>;
  /**
   * Force a refetch in api mode by changing this value. The table also resets
   * `page` to 1 on change, mirroring the multifilter Buscar semantics. Useful
   * when the page drives its own filter UI separate from a bound multifilter.
   */
  refetchSignal?: unknown;
  /** External `where` to merge into every fetch. Used when the page drives its own filter UI. */
  externalFilter?: { where?: Record<string, unknown> };

  /**
   * In local pagination mode, this function decides whether a row passes the
   * current `where` clause (built from the bound multifilter and/or
   * `externalFilter`). Defaults to `matchLoopbackWhere` — a pure evaluator for
   * the LoopBack `where` DSL — so a multifilter authored once works the same
   * locally and against an API.
   *
   * Override to:
   *  - extend matching with domain rules (`(row, where) => matchLoopbackWhere(row, where) && row.isActive`)
   *  - speak a different DSL than LoopBack
   *  - run hand-written predicates that ignore `where` entirely
   *
   * Ignored when `paginationMode` is `'api'` (the server filters there).
   */
  localMatch?: (row: T, where: LoopbackFilter['where'] | undefined) => boolean;

  /**
   * Resolve a stable id for a row. Defaults to `row.id` (cast to string).
   * Override only if your rows don't have a top-level `id` field.
   */
  getRowId?: (row: T) => string;
  itemsPerPage?: number;
  itemsPerPageOptions?: number[];

  /**
   * Controls how the pagination footer is displayed. Independent of
   * `paginationMode` (which decides where slicing happens — local or api).
   *
   * - `'always'` (default): full footer — rows-per-page selector, item count,
   *   page selector + nav. Matches the historical behavior.
   * - `'fixedItemsPerPage'`: rows-per-page selector is hidden (the value is
   *   considered fixed). Item count is always visible. Page selector + nav
   *   appear only when `totalCount > itemsPerPage`. Good for tables where
   *   the page size is a deliberate product choice but you still want
   *   pagination on overflow.
   * - `'fixedTotalItems'`: the footer is not rendered at all. Pair with a
   *   large `itemsPerPage` so every row fits in a single page. Good for
   *   short, naturally-bounded lists (a product's plans, conditions,
   *   periods, …) where pagination is just noise.
   */
  paginationDisplay?: 'always' | 'fixedItemsPerPage' | 'fixedTotalItems';

  enableRowSelection?: boolean;
  selectAllScope?: 'page' | 'all' | 'toggleable';
  /**
   * How to handle "select all matching" (wildcard) selections in api mode.
   *
   * - `'lazy'` (default): emit `{ scope: 'all', mode: 'wildcard', exceptIds }`.
   *   The host page is responsible for materializing the full id list when
   *   needed (typically at action time). Cheap; selection is independent of
   *   row count; column ordering remains free.
   *
   * - `'eager'`: as soon as the user enters wildcard, the table paginates
   *   `fetchData` with the active filter to materialize every matching id
   *   and emits `{ scope: 'all', mode: 'in-memory', ids: [...full] }` once
   *   resolved. While a wildcard selection is active, **column sorting is
   *   locked** (otherwise the captured order would silently desync from
   *   the rendered view). Best for flows that need the full id list up
   *   front (preview, reorder, in-memory transforms before submit).
   *
   * Has no effect when `paginationMode === 'local'` (the table already
   * knows the full set in memory).
   */
  selectAllResolution?: 'lazy' | 'eager';
  onSelectionChange?: (event: SelectionChange<T>) => void;

  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: ReactNode;

  onRowClick?: (row: T) => void;
  /**
   * Highlight rows independently of selection. Useful for master/detail UIs
   * where the active row should stay marked. Returning `true` adds a `bg-muted/50`
   * tint plus `data-highlighted="true"` on the row for custom styling.
   */
  isRowHighlighted?: (row: T) => boolean;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;

  showColumnVisibility?: boolean;
  /**
   * Cap the table body's height so it scrolls vertically instead of expanding
   * the page when there are many rows per page. Number → pixels; string →
   * any CSS length (`'60vh'`, `'400px'`). The header stays sticky at the top
   * of the scroll container while rows scroll underneath.
   *
   * Use together with horizontal scroll: the same container handles both, so
   * the layout stays consistent (toolbar + clamped scrollable region +
   * pagination footer). When unset, the table grows to its natural height
   * and the page scrolls.
   */
  maxBodyHeight?: number | string;
  labels?: Partial<TableLabels>;
  className?: string;
}

