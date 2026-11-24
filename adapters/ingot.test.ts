import { describe, expect, it, vi } from 'vitest';
import { createIngotTableFetcher, toIngotWhere } from './ingot';
import { buildCondition } from '../multifilter/hooks/useMultifilterQuery';
import type { FieldDef } from '../types/multifilter.types';

describe('toIngotWhere', () => {
  it('renames mongo-style operators to ingot names, at any depth', () => {
    expect(
      toIngotWhere({
        status: { $in: ['a', 'b'] },
        kind: { $nin: ['x'] },
        score: { $gte: 1, $lte: 5 },
        age: { $gt: 1, $lt: 9 },
        name: { $ne: 'x' },
        alias: { $neq: 'y' },
        code: { $eq: 'z' },
        deletedAt: { $exists: false },
        $or: [{ a: 1 }, { $and: [{ b: { $in: [2] } }, { c: 3 }] }],
      })
    ).toEqual({
      status: { inq: ['a', 'b'] },
      kind: { nin: ['x'] },
      score: { gte: 1, lte: 5 },
      age: { gt: 1, lt: 9 },
      name: { neq: 'x' },
      alias: { neq: 'y' },
      code: { eq: 'z' },
      deletedAt: { exists: false },
      or: [{ a: 1 }, { and: [{ b: { inq: [2] } }, { c: 3 }] }],
    });
  });

  it('leaves equality values, dotted paths and ingot-native operators alone', () => {
    const where = { 'attributes.ambito': 'x', status: { inq: ['a'] }, flag: true, n: null };
    expect(toIngotWhere(where)).toEqual(where);
  });

  it('turns the text search regex into a literal like/ilike', () => {
    expect(toIngotWhere({ name: { $regex: '.*sumol\\+compal.*', $options: 'i' } })).toEqual({
      name: { ilike: 'sumol+compal' },
    });
    expect(toIngotWhere({ name: { $regex: 'ACME \\(S\\.A\\.\\)' } })).toEqual({
      name: { like: 'ACME (S.A.)' },
    });
    expect(toIngotWhere({ name: { $regex: '.*.*', $options: 'i' } })).toEqual({ name: { ilike: '' } });
  });

  it('translates what the multifilter emits for every field type', () => {
    const defs: [FieldDef, unknown][] = [
      [{ id: 'q', type: 'text', label: 'q', fields: ['name', 'documentId'] }, '(S.A.)'],
      [{ id: 's', type: 'multiselect', label: 's', field: 'status', options: [] }, ['a']],
      [{ id: 'd', type: 'dateRange', label: 'd', field: 'createdAt' }, { from: new Date('2026-01-01T00:00:00Z') }],
      [{ id: 'n', type: 'numberRange', label: 'n', field: 'score' }, { min: 2, max: 3 }],
    ] as never;
    const where = Object.assign({}, ...defs.map(([def, v]) => buildCondition(def, v)));
    expect(toIngotWhere(where)).toEqual({
      or: [{ name: { ilike: '(S.A.)' } }, { documentId: { ilike: '(S.A.)' } }],
      status: { inq: ['a'] },
      createdAt: { gte: '2026-01-01T00:00:00.000Z' },
      score: { gte: 2, lte: 3 },
    });
  });

  it('refuses what ingot cannot express instead of dropping it', () => {
    expect(() => toIngotWhere({ $not: { a: 1 } })).toThrow(/\$not/);
    expect(() => toIngotWhere({ a: { $foo: 1 } })).toThrow(/\$foo/);
    expect(() => toIngotWhere({ name: { $regex: '^acme' } })).toThrow(/regex/);
    expect(() => toIngotWhere({ name: { $regex: 'a.c' } })).toThrow(/regex/);
    expect(() => toIngotWhere({ name: { $regex: 'acme', $options: 'm' } })).toThrow(/\$options/);
  });
});

describe('createIngotTableFetcher', () => {
  it('sends one translated filter and takes the total from the page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: [{ id: '1' }], totalCount: 42 });
    const fetcher = createIngotTableFetcher({
      fetchPage,
      include: [{ relation: 'subject' }],
      fields: ['id', 'name'],
      defaultOrder: ['updatedAt DESC'],
    });

    const result = await fetcher({
      page: 3,
      itemsPerPage: 10,
      sort: { column: 'name', descending: false },
      filter: { where: { status: { $in: ['a'] } } },
    });

    expect(result).toEqual({ rows: [{ id: '1' }], totalCount: 42 });
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledWith({
      where: { status: { inq: ['a'] } },
      skip: 20,
      limit: 10,
      order: ['name ASC'],
      include: [{ relation: 'subject' }],
      fields: ['id', 'name'],
    });
  });

  it('uses the default order and asks only for ids when idsOnly', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: [], totalCount: 0 });
    const fetcher = createIngotTableFetcher({
      fetchPage,
      include: [{ relation: 'subject' }],
      fields: ['id', 'name'],
      defaultOrder: ['updatedAt DESC'],
    });

    await fetcher({ page: 1, itemsPerPage: 50, sort: null, idsOnly: true });

    expect(fetchPage).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      limit: 50,
      order: ['updatedAt DESC'],
      fields: ['id'],
    });
  });
});
