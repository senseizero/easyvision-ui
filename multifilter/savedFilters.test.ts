import { describe, expect, it } from 'vitest';
import { fromStored, readSaved, toStored, writeSaved } from './savedFilters';
import type { FieldDef } from '../types/multifilter.types';

const fields = [
  { id: 'status', type: 'multiselect', label: 'Estado', field: 'status', options: [] },
  { id: 'score', type: 'numberRange', label: 'Score', field: 'score' },
  { id: 'created', type: 'dateRange', label: 'Fecha', field: 'createdAt' },
  { id: 'q', type: 'text', label: 'Buscar', field: 'name' },
  { id: 'nested', type: 'multifilter', label: 'Sub', config: { fields: [] } },
] as FieldDef[];

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('toStored / fromStored', () => {
  it('keeps lists, ranges and text, drops empties, nested and unknown ids', () => {
    expect(
      toStored(
        { status: ['DONE'], score: { min: 2 }, q: 'acme', empty: [], nested: { x: 1 }, other: 'x', created: {} },
        fields
      )
    ).toEqual({ status: ['DONE'], score: { min: 2 }, q: 'acme' });
  });

  it('stores dates as local days, Date or ISO string alike, and restores local midnight', () => {
    const from = new Date(2026, 0, 31);
    const to = new Date(2026, 1, 2, 23, 30);
    const stored = toStored({ created: { from, to: to.toISOString() } }, fields);
    expect(stored).toEqual({ created: { from: '2026-01-31', to: '2026-02-02' } });

    const back = fromStored(stored, fields).created as { from: Date; to: Date };
    expect(back.from.getTime()).toBe(new Date(2026, 0, 31).getTime());
    expect(back.to.getTime()).toBe(new Date(2026, 1, 2).getTime());
  });

  it("reads what nml-vision v3 saved: a single choice as a string, unknown ids ignored", () => {
    expect(fromStored({ status: 'DONE', score: { max: 3 }, gone: ['x'] }, fields)).toEqual({
      status: ['DONE'],
      score: { max: 3 },
    });
  });
});

describe('readSaved / writeSaved', () => {
  it('round-trips in the v3 shape', () => {
    const storage = memoryStorage();
    const store = {
      items: [{ name: 'Fallidas', filters: { status: ['FAILED'] }, search: [] }],
      defaultName: 'Fallidas',
    };
    writeSaved(storage, 'k', store);
    expect(JSON.parse(storage.data.k)).toEqual(store);
    expect(readSaved(storage, 'k')).toEqual(store);
  });

  it('reads garbage as nothing and forgets a default that no longer exists', () => {
    expect(readSaved(memoryStorage({ k: '{not json' }), 'k')).toEqual({ items: [], defaultName: null });
    expect(
      readSaved(
        memoryStorage({ k: JSON.stringify({ items: [{ name: 'a', filters: {} }, { bad: 1 }], defaultName: 'z' }) }),
        'k'
      )
    ).toEqual({ items: [{ name: 'a', filters: {}, search: [] }], defaultName: null });
  });
});
