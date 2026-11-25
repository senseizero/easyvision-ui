import { describe, expect, it, vi } from 'vitest';
import { buildCsv, exportCsv } from './buildCsv';
import type { SheetSpec } from '../types/export.types';

type Row = { title: string; score: number | null; tags: string[]; at: Date | null };
const sheet = (rows: Row[]): SheetSpec<Row> => ({
  name: 'Alertas',
  columns: [
    { header: 'Título', getValue: (r) => r.title },
    { header: 'Score', getValue: (r) => r.score },
    { header: 'Tópicos', getValue: (r) => r.tags.join(', ') },
    { header: 'Fecha', getValue: (r) => r.at },
  ],
  rows,
});
const ROWS: Row[] = [
  { title: 'Apagón; "grave"', score: 0.81, tags: ['Suministro', 'Clima'], at: new Date('2026-11-18T00:00:00Z') },
  { title: 'Línea 1\nLínea 2', score: null, tags: [], at: null },
];

describe('buildCsv', () => {
  it('writes a BOM, a header and CRLF lines, quoting what needs it (RFC 4180)', () => {
    const csv = buildCsv(sheet(ROWS), ',');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Título,Score,Tópicos,Fecha',
      '"Apagón; ""grave""",0.81,"Suministro, Clima",2026-11-18T00:00:00.000Z',
      '"Línea 1\nLínea 2",,,',
      '',
    ]);
  });

  it("with ';' (es/pt/fr Excel) splits on ';' and writes decimals with ','", () => {
    const [, first] = buildCsv(sheet(ROWS), ';').slice(1).split('\r\n');
    expect(first).toBe('"Apagón; ""grave""";0,81;Suministro, Clima;2026-11-18T00:00:00.000Z');
  });
});

describe('exportCsv', () => {
  it('one file per sheet, empty ones skipped; nothing written when all are empty', async () => {
    const download = vi.fn();
    const other: SheetSpec<Row> = { ...sheet(ROWS), name: 'Otra' };
    expect(exportCsv([sheet(ROWS), sheet([]), other], { filename: 'lista', download })).toBe(true);
    expect(download).toHaveBeenCalledTimes(2);
    const [blob, name] = download.mock.calls[0];
    expect(name).toMatch(/^lista_Alertas_.*\.csv$/);
    expect((blob as Blob).type).toBe('text/csv;charset=utf-8');
    expect(await (blob as Blob).text()).toContain('Título,Score');

    download.mockClear();
    expect(exportCsv([sheet(ROWS)], { filename: 'lista', download })).toBe(true);
    expect(download.mock.calls[0][1]).toMatch(/^lista_[^_]*\.csv$/);

    download.mockClear();
    expect(exportCsv([sheet([])], { filename: 'lista', download })).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });
});
