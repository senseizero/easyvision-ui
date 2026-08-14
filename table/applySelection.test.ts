import { describe, expect, it } from 'vitest';
import { applySelection } from './applySelection';
import type { TableSelection } from '../store/slice-types';

interface Row {
  id: string;
}

const ROWS: Row[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const getRowId = (row: Row) => row.id;

describe('applySelection', () => {
  it('returns every row when nothing is ticked', () => {
    const selection: TableSelection = { ids: {}, scope: 'page' };
    expect(applySelection(ROWS, selection, getRowId)).toEqual(ROWS);
  });

  it('keeps only ticked ids, including ids not present in the given rows', () => {
    const selection: TableSelection = { ids: { a: true, zz: true }, scope: 'page' };
    expect(applySelection(ROWS, selection, getRowId)).toEqual([{ id: 'a' }]);
  });

  it('returns every row for an unmodified select-all', () => {
    const selection: TableSelection = { ids: {}, scope: 'all' };
    expect(applySelection(ROWS, selection, getRowId)).toEqual(ROWS);
  });

  it('drops unticked ids from a wildcard select-all', () => {
    const selection: TableSelection = {
      ids: {},
      scope: 'all',
      exceptIds: { b: true },
    };
    expect(applySelection(ROWS, selection, getRowId)).toEqual([
      { id: 'a' },
      { id: 'c' },
    ]);
  });

  it('ignores page-scope ids when the scope is all', () => {
    const selection: TableSelection = { ids: { a: true }, scope: 'all' };
    expect(applySelection(ROWS, selection, getRowId)).toEqual(ROWS);
  });

  it('preserves the incoming row order', () => {
    const selection: TableSelection = { ids: { c: true, a: true }, scope: 'page' };
    expect(applySelection(ROWS, selection, getRowId).map(getRowId)).toEqual(['a', 'c']);
  });
});
