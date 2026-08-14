import { describe, expect, it } from 'vitest';
import { isColumnVisible, resolveColumnVisibility } from './columnVisibility';
import type { EasyVisionColumn } from '../types/table.types';

interface Row {
  id: string;
}

const COLUMNS: EasyVisionColumn<Row>[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Nombre', initiallyHidden: true },
  { field: 'notes', header: 'Notas' },
];

describe('resolveColumnVisibility', () => {
  it('seeds false from initiallyHidden and leaves other columns unlisted', () => {
    expect(resolveColumnVisibility(COLUMNS, {})).toEqual({ name: false });
  });

  it('lets slice toggles override the declared default in both directions', () => {
    expect(resolveColumnVisibility(COLUMNS, { name: true, id: false })).toEqual({
      name: true,
      id: false,
    });
  });

  it('honours the declared default for a column added after the slice was persisted', () => {
    // Slice persisted before `notes` existed: it must still follow its default.
    const withNewHidden: EasyVisionColumn<Row>[] = [
      ...COLUMNS,
      { field: 'extra', header: 'Extra', initiallyHidden: true },
    ];
    const resolved = resolveColumnVisibility(withNewHidden, { name: true });
    expect(resolved.extra).toBe(false);
  });
});

describe('isColumnVisible', () => {
  it('treats an unlisted column as visible', () => {
    expect(isColumnVisible({}, 'id')).toBe(true);
  });

  it('treats only an explicit false as hidden', () => {
    expect(isColumnVisible({ id: false }, 'id')).toBe(false);
    expect(isColumnVisible({ id: true }, 'id')).toBe(true);
  });
});
