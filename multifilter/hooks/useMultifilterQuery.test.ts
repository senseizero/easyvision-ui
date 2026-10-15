import { describe, expect, it } from 'vitest';
import { buildCondition } from './useMultifilterQuery';
import { matchLoopbackWhere } from '../../adapters/loopback';
import type { TextFieldDef } from '../../types/multifilter.types';

const nameField: TextFieldDef = { id: 'q', type: 'text', label: 'Nombre', field: 'name' };

function matches(search: string, name: string) {
  return matchLoopbackWhere({ name }, buildCondition(nameField, search) as never);
}

describe('buildCondition for text fields', () => {
  it('matches regex metacharacters literally', () => {
    expect(matches('SUMOL+COMPAL', 'SUMOL+COMPAL MARCAS')).toBe(true);
    expect(matches('A.B', 'AXB')).toBe(false);
    expect(matches('(S.A.)', 'ACME (S.A.)')).toBe(true);
    expect(matches('[x]*?^$|\\', 'a [x]*?^$|\\ b')).toBe(true);
  });

  it('stays a case-insensitive substring search', () => {
    expect(buildCondition(nameField, '  sumol+compal ')).toEqual({
      name: { $regex: '.*sumol\\+compal.*', $options: 'i' },
    });
    expect(matches('marcas', 'SUMOL+COMPAL MARCAS')).toBe(true);
  });
});
