import { describe, expect, it } from 'vitest';
import { sortLocalRows } from './sortLocalRows';
import type { EasyVisionColumn } from '../types/table.types';

interface Row {
  id: string;
  name: string;
  nested: { score: number };
}

const ROWS: Row[] = [
  { id: 'b', name: 'Beta', nested: { score: 2 } },
  { id: 'a', name: 'Alpha', nested: { score: 3 } },
  { id: 'c', name: 'Charlie', nested: { score: 1 } },
];

const COLUMNS: EasyVisionColumn<Row>[] = [
  { field: 'id', header: 'Id' },
  { field: 'name', header: 'Name' },
  { field: 'nested.score', header: 'Score' },
  { type: 'ui', field: 'actions', header: 'Actions', cell: () => null },
];

describe('sortLocalRows', () => {
  it('returns the input unchanged, same reference, when there is no sort', () => {
    const result = sortLocalRows(ROWS, COLUMNS, null);
    expect(result).toBe(ROWS);
    expect(result).toEqual([
      { id: 'b', name: 'Beta', nested: { score: 2 } },
      { id: 'a', name: 'Alpha', nested: { score: 3 } },
      { id: 'c', name: 'Charlie', nested: { score: 1 } },
    ]);
  });

  it('sorts ascending by a flat field without mutating the input', () => {
    const before = [...ROWS];
    const result = sortLocalRows(ROWS, COLUMNS, { column: 'name', descending: false });
    expect(result.map((r) => r.name)).toEqual(['Alpha', 'Beta', 'Charlie']);
    expect(ROWS).toEqual(before);
    expect(result).not.toBe(ROWS);
  });

  it('sorts descending by a flat field', () => {
    const result = sortLocalRows(ROWS, COLUMNS, { column: 'name', descending: true });
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Beta', 'Alpha']);
  });

  it('returns the input unchanged when the sort column is missing from columns', () => {
    const result = sortLocalRows(ROWS, COLUMNS, { column: 'ghost', descending: false });
    expect(result).toBe(ROWS);
  });

  it('returns the input unchanged when the sort column is a ui column', () => {
    const result = sortLocalRows(ROWS, COLUMNS, { column: 'actions', descending: false });
    expect(result).toBe(ROWS);
  });

  it('sorts by a nested dot-path field', () => {
    const result = sortLocalRows(ROWS, COLUMNS, { column: 'nested.score', descending: false });
    expect(result.map((r) => r.nested.score)).toEqual([1, 2, 3]);
  });
});
