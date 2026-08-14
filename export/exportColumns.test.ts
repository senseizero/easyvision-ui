import { describe, expect, it } from 'vitest';
import { toExportCellValue, toExportColumns } from './exportColumns';
import type { EasyVisionColumn } from '../types/table.types';

interface Row {
  id: string;
  name: string;
  topics: string[];
  client: { name: string };
  created: Date;
}

const ROW: Row = {
  id: '1',
  name: 'Alpha',
  topics: ['fraude', 'blanqueo'],
  client: { name: 'Acme' },
  created: new Date('2026-01-15T00:00:00.000Z'),
};

const ALL_VISIBLE = () => true;

describe('toExportCellValue', () => {
  it('joins arrays with a comma', () => {
    expect(toExportCellValue(['a', 'b'])).toBe('a, b');
  });

  it('passes primitives and dates through', () => {
    expect(toExportCellValue('x')).toBe('x');
    expect(toExportCellValue(3)).toBe(3);
    expect(toExportCellValue(false)).toBe(false);
    expect(toExportCellValue(ROW.created)).toBe(ROW.created);
  });

  it('maps null and undefined to null', () => {
    expect(toExportCellValue(null)).toBeNull();
    expect(toExportCellValue(undefined)).toBeNull();
  });

  it('stringifies anything else', () => {
    expect(toExportCellValue({ a: 1 })).toBe('[object Object]');
  });
});

describe('toExportColumns', () => {
  it('defaults the header to a string `header`, else to `field`', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'name', header: 'Nombre' },
      { field: 'id', header: () => null },
    ];
    expect(toExportColumns(columns, ALL_VISIBLE).map((c) => c.header)).toEqual([
      'Nombre',
      'id',
    ]);
  });

  it('prefers exportHeader over header', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'name', header: 'Nombre', exportHeader: 'Nombre completo' },
    ];
    expect(toExportColumns(columns, ALL_VISIBLE)[0].header).toBe('Nombre completo');
  });

  it('reads nested fields by dot-path and joins arrays', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'client.name', header: 'Cliente' },
      { field: 'topics', header: 'Tópicos' },
    ];
    const specs = toExportColumns(columns, ALL_VISIBLE);
    expect(specs[0].getValue(ROW)).toBe('Acme');
    expect(specs[1].getValue(ROW)).toBe('fraude, blanqueo');
  });

  it('uses exportValue when given, coercing its result', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'topics', header: 'Tópicos', exportValue: (r) => r.topics.length },
      { field: 'name', header: 'Nombre', exportValue: (r) => [r.name, r.id] as any },
    ];
    const specs = toExportColumns(columns, ALL_VISIBLE);
    expect(specs[0].getValue(ROW)).toBe(2);
    expect(specs[1].getValue(ROW)).toBe('Alpha, 1');
  });

  it('excludes ui columns by default and includes them when opted in', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { type: 'ui', field: 'actions', header: '', cell: () => null },
      {
        type: 'ui',
        field: 'computed',
        header: 'Calculado',
        cell: () => null,
        exportable: true,
        exportValue: (r) => r.topics.length,
      },
    ];
    const specs = toExportColumns(columns, ALL_VISIBLE);
    expect(specs.map((c) => c.header)).toEqual(['Calculado']);
    expect(specs[0].getValue(ROW)).toBe(2);
  });

  it('excludes data columns marked exportable: false', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'name', header: 'Nombre' },
      { field: 'id', header: 'ID', exportable: false },
    ];
    expect(toExportColumns(columns, ALL_VISIBLE).map((c) => c.header)).toEqual([
      'Nombre',
    ]);
  });

  it('excludes columns the visibility predicate rejects', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'name', header: 'Nombre' },
      { field: 'id', header: 'ID' },
    ];
    const specs = toExportColumns(columns, (field) => field !== 'id');
    expect(specs.map((c) => c.header)).toEqual(['Nombre']);
  });

  it('preserves the declared column order', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Nombre' },
      { field: 'client.name', header: 'Cliente' },
    ];
    expect(toExportColumns(columns, ALL_VISIBLE).map((c) => c.header)).toEqual([
      'ID',
      'Nombre',
      'Cliente',
    ]);
  });

  it('forwards exportStyle and omits getStyle when absent', () => {
    const columns: EasyVisionColumn<Row>[] = [
      { field: 'name', header: 'Nombre', exportStyle: () => ({ bold: true }) },
      { field: 'id', header: 'ID' },
    ];
    const specs = toExportColumns(columns, ALL_VISIBLE);
    expect(specs[0].getStyle!('Alpha', ROW)).toEqual({ bold: true });
    expect(specs[1].getStyle).toBeUndefined();
  });
});
