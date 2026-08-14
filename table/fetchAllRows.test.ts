import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows, mergeFilters } from './fetchAllRows';
import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';

interface Row {
  id: string;
}

/** Fake API over a fixed dataset, recording the params it was called with. */
const makeFetcher = (total: number) => {
  const calls: ApiFetchParams[] = [];
  const all: Row[] = Array.from({ length: total }, (_, i) => ({ id: String(i) }));
  const fetchData = async (params: ApiFetchParams): Promise<ApiFetchResult<Row>> => {
    calls.push(params);
    const start = (params.page - 1) * params.itemsPerPage;
    return { rows: all.slice(start, start + params.itemsPerPage), totalCount: total };
  };
  return { fetchData, calls };
};

describe('mergeFilters', () => {
  it('returns undefined when neither side has anything', () => {
    expect(mergeFilters(undefined, undefined)).toBeUndefined();
  });

  it('lets the multifilter win on colliding where keys', () => {
    const merged = mergeFilters(
      { where: { status: 'OPEN', clientId: 'a' } },
      { where: { status: 'CLOSED' }, order: ['created DESC'] }
    );
    expect(merged).toEqual({
      where: { clientId: 'a', status: 'CLOSED' },
      order: ['created DESC'],
    });
  });

  it('keeps the external where when the multifilter has none', () => {
    expect(mergeFilters({ where: { a: 1 } }, undefined)).toEqual({ where: { a: 1 } });
  });
});

describe('fetchAllRows', () => {
  it('pages until the known total is collected', async () => {
    const { fetchData, calls } = makeFetcher(450);
    const rows = await fetchAllRows({ fetchData, filter: undefined, sort: null });

    expect(rows).toHaveLength(450);
    expect(calls.map((c) => c.page)).toEqual([1, 2, 3]);
    expect(calls[0].itemsPerPage).toBe(200);
  });

  it('stops on a short page even if the total disagrees', async () => {
    const fetchData = vi.fn(async () => ({
      rows: [{ id: 'a' }],
      totalCount: 9999,
    }));
    const rows = await fetchAllRows({ fetchData, filter: undefined, sort: null });

    expect(rows).toEqual([{ id: 'a' }]);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when there is nothing to fetch', async () => {
    const { fetchData } = makeFetcher(0);
    expect(await fetchAllRows({ fetchData, filter: undefined, sort: null })).toEqual([]);
  });

  it('forwards sort, filter and idsOnly on every page', async () => {
    const { fetchData, calls } = makeFetcher(250);
    const filter = { where: { status: 'OPEN' } };
    const sort = { column: 'created', descending: true };
    await fetchAllRows({ fetchData, filter, sort, idsOnly: true });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.filter).toBe(filter);
      expect(call.sort).toBe(sort);
      expect(call.idsOnly).toBe(true);
    }
  });

  it('aborts and returns null when shouldContinue turns false', async () => {
    const { fetchData, calls } = makeFetcher(1000);
    let allowed = 2;
    const rows = await fetchAllRows({
      fetchData,
      filter: undefined,
      sort: null,
      shouldContinue: () => allowed-- > 0,
    });

    expect(rows).toBeNull();
    expect(calls.length).toBeLessThan(5);
  });
});
