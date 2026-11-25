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

describe('buildCondition for text fields with several paths', () => {
  const multiField: TextFieldDef = { id: 'q', type: 'text', label: 'Buscar', fields: ['name', 'documentId'] };
  const matchesAny = (search: string, row: Record<string, string>) =>
    matchLoopbackWhere(row, buildCondition(multiField, search) as never);

  it('matches literally on any of the paths', () => {
    expect(matchesAny('SUMOL+COMPAL', { name: 'SUMOL+COMPAL MARCAS', documentId: 'PT1' })).toBe(true);
    expect(matchesAny('b123', { name: 'ACME', documentId: 'B12345' })).toBe(true);
    expect(matchesAny('A.B', { name: 'AXB', documentId: 'AXB' })).toBe(false);
  });

  it('builds one $or and ignores blank input', () => {
    expect(buildCondition(multiField, ' acme ')).toEqual({
      $or: [
        { name: { $regex: '.*acme.*', $options: 'i' } },
        { documentId: { $regex: '.*acme.*', $options: 'i' } },
      ],
    });
    expect(buildCondition(multiField, '   ')).toBeUndefined();
  });
});

describe('the main search, several terms', () => {
  const search: TextFieldDef = { id: 'q', type: 'text', label: 'Buscar', fields: ['name', 'documentId'] };
  const single: TextFieldDef = { id: 'q', type: 'text', label: 'Buscar', field: 'name' };

  it('matches any term on any path', () => {
    expect(buildCondition(search, ['acme', 'b12'])).toEqual({
      $or: [
        { name: { $regex: '.*acme.*', $options: 'i' } },
        { documentId: { $regex: '.*acme.*', $options: 'i' } },
        { name: { $regex: '.*b12.*', $options: 'i' } },
        { documentId: { $regex: '.*b12.*', $options: 'i' } },
      ],
    });
    expect(buildCondition(single, ['acme', 'globex'])).toEqual({
      $or: [{ name: { $regex: '.*acme.*', $options: 'i' } }, { name: { $regex: '.*globex.*', $options: 'i' } }],
    });
  });

  it('one term, as a list or as a string, is the single search it always was', () => {
    expect(buildCondition(single, ['acme'])).toEqual(buildCondition(single, 'acme'));
    expect(buildCondition(single, [' acme ', 'acme', ''])).toEqual({ name: { $regex: '.*acme.*', $options: 'i' } });
    expect(buildCondition(single, [])).toBeUndefined();
  });

  it('filters in memory with the same rule', () => {
    const where = buildCondition(search, ['acme', 'b12']) as never;
    expect(matchLoopbackWhere({ name: 'ACME SA', documentId: 'X' }, where)).toBe(true);
    expect(matchLoopbackWhere({ name: 'Globex', documentId: 'B12345' }, where)).toBe(true);
    expect(matchLoopbackWhere({ name: 'Globex', documentId: 'X' }, where)).toBe(false);
  });
});
