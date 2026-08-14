import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';
import type { MultifilterQuery } from '../types/multifilter.types';

/** Page size used when materializing an entire result set. */
export const FETCH_ALL_PAGE_SIZE = 200;

/**
 * Combine an externally-driven filter with the multifilter's confirmed query.
 * The multifilter is spread second so it wins on colliding `where` keys —
 * a bound filter panel should be able to override a page-level default.
 */
export const mergeFilters = (
  externalFilter: { where?: Record<string, unknown> } | undefined,
  multifilterQuery: MultifilterQuery | undefined
): MultifilterQuery | undefined =>
  externalFilter || multifilterQuery
    ? {
        ...multifilterQuery,
        where: {
          ...(externalFilter?.where ?? {}),
          ...(multifilterQuery?.where ?? {}),
        },
      }
    : undefined;

export interface FetchAllRowsParams<T> {
  fetchData: (params: ApiFetchParams) => Promise<ApiFetchResult<T>>;
  filter: MultifilterQuery | undefined;
  sort: ApiFetchParams['sort'];
  /** Hint adapters they may shrink the payload to ids only. */
  idsOnly?: boolean;
  pageSize?: number;
  /** Return false to abort — e.g. a newer request superseded this one. */
  shouldContinue?: () => boolean;
}

/**
 * Page through `fetchData` until the whole matching set is in memory.
 * Returns null when aborted via `shouldContinue`, so callers can tell an
 * abort apart from a genuinely empty result.
 */
export async function fetchAllRows<T>({
  fetchData,
  filter,
  sort,
  idsOnly = false,
  pageSize = FETCH_ALL_PAGE_SIZE,
  shouldContinue,
}: FetchAllRowsParams<T>): Promise<T[] | null> {
  const collected: T[] = [];
  let knownTotal = Infinity;

  for (let page = 1; collected.length < knownTotal; page++) {
    const result = await fetchData({
      page,
      itemsPerPage: pageSize,
      sort,
      filter,
      idsOnly,
    });
    if (shouldContinue && !shouldContinue()) return null;
    knownTotal = result.totalCount;
    collected.push(...result.rows);
    if (result.rows.length < pageSize) break;
  }

  return collected;
}
