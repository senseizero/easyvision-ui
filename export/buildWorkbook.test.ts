import { describe, expect, it, vi } from 'vitest';
import { buildWorkbook, exportSheets, sanitizeSheetName } from './buildWorkbook';
import type { SheetSpec } from '../types/export.types';

interface Row {
  id: string;
  name: string;
  score: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Alpha', score: 3.8 },
  { id: '2', name: 'Beta', score: 1.2 },
];

const SHEET: SheetSpec<Row> = {
  name: 'Alertas',
  columns: [
    { header: 'Nombre', getValue: (r) => r.name },
    {
      header: 'Puntuación',
      getValue: (r) => r.score,
      getStyle: (value) =>
        typeof value === 'number' && value >= 3.5
          ? { fill: 'FF991B1B', fontColor: 'FFFFFFFF', bold: true }
          : undefined,
    },
  ],
  rows: ROWS,
};

describe('buildWorkbook', () => {
  it('writes one worksheet with a styled header row', async () => {
    const workbook = await buildWorkbook([SHEET]);

    expect(workbook).not.toBeNull();
    expect(workbook!.worksheets).toHaveLength(1);

    const header = workbook!.getWorksheet('Alertas')!.getRow(1);
    expect(header.getCell(1).value).toBe('Nombre');
    expect(header.getCell(2).value).toBe('Puntuación');
    expect(header.getCell(1).font?.bold).toBe(true);
    expect((header.getCell(1).fill as any).fgColor.argb).toBe('FFCCCCCC');
  });

  it('writes one row per item, in order', async () => {
    const workbook = await buildWorkbook([SHEET]);
    const sheet = workbook!.getWorksheet('Alertas')!;

    expect(sheet.rowCount).toBe(3); // header + 2
    expect(sheet.getRow(2).getCell(1).value).toBe('Alpha');
    expect(sheet.getRow(3).getCell(2).value).toBe(1.2);
  });

  it('applies getStyle per cell, only where it returns a style', async () => {
    const workbook = await buildWorkbook([SHEET]);
    const sheet = workbook!.getWorksheet('Alertas')!;

    const flagged = sheet.getRow(2).getCell(2);
    expect((flagged.fill as any).fgColor.argb).toBe('FF991B1B');
    expect(flagged.font?.bold).toBe(true);
    expect(flagged.font?.color?.argb).toBe('FFFFFFFF');

    // ExcelJS leaves `fill` undefined on an unstyled cell (style defaults to {}).
    expect(sheet.getRow(3).getCell(2).fill).toBeUndefined();
    expect(sheet.getRow(3).getCell(2).font).toBeUndefined();
  });

  it('auto-fits column widths to the longest cell, with a floor of 10', async () => {
    const workbook = await buildWorkbook([SHEET]);
    const sheet = workbook!.getWorksheet('Alertas')!;

    expect(sheet.getColumn(1).width).toBe(10); // 'Nombre' is 6 → floor
    expect(sheet.getColumn(2).width).toBe(12); // 'Puntuación' is 10 → +2
  });

  it('measures a null cell as zero-length, not the floor', async () => {
    interface NoteRow {
      note: string | null;
      status: string;
    }
    const sheet: SheetSpec<NoteRow> = {
      name: 'Notes',
      columns: [
        { header: 'Note', getValue: (r) => r.note },
        { header: 'Status', getValue: (r) => r.status },
      ],
      // The row survives because `status` is non-null; `note` alone is null.
      rows: [{ note: null, status: 'ok' }],
    };

    const workbook = await buildWorkbook([sheet]);
    const ws = workbook!.getWorksheet('Notes')!;

    // Longest rendered value in column 1 is the header 'Note' (4 chars); the
    // null data cell contributes 0, not the 10-char floor. max(10, 4+2) = 10.
    expect(ws.getColumn(1).width).toBe(10);
  });

  it('measures a Date cell by its fixed-length ISO string, not a locale-dependent toString()', async () => {
    interface DateRow {
      when: Date;
    }
    const sheet: SheetSpec<DateRow> = {
      name: 'Dates',
      columns: [{ header: 'When', getValue: (r) => r.when }],
      rows: [{ when: new Date('2026-01-01T00:00:00.000Z') }],
    };

    const workbook = await buildWorkbook([sheet]);
    const ws = workbook!.getWorksheet('Dates')!;

    // `Date.prototype.toISOString()` is always exactly 24 characters
    // ("2026-01-01T00:00:00.000Z"), independent of the machine's timezone —
    // unlike `Date.prototype.toString()`, which varies in both length and
    // content by locale/timezone. max(10, 24+2) = 26.
    expect(ws.getColumn(1).width).toBe(26);
  });
});

const sheetOf = (name: string, rows: Row[] = ROWS): SheetSpec<Row> => ({
  name,
  columns: [{ header: 'Nombre', getValue: (r) => r.name }],
  rows,
});

describe('sanitizeSheetName', () => {
  it('replaces the characters Excel forbids', () => {
    expect(sanitizeSheetName('a*b?c:d\\e/f[g]h')).toBe('a-b-c-d-e-f-g-h');
  });

  it('truncates to 31 characters', () => {
    expect(sanitizeSheetName('x'.repeat(40))).toHaveLength(31);
  });

  it('falls back to a placeholder for an empty name', () => {
    expect(sanitizeSheetName('')).toBe('Hoja');
  });
});

describe('buildWorkbook multi-sheet', () => {
  it('writes one sheet per spec, in the order given', async () => {
    const workbook = await buildWorkbook([sheetOf('Alertas'), sheetOf('Clientes')]);
    expect(workbook!.worksheets.map((w) => w.name)).toEqual(['Alertas', 'Clientes']);
  });

  it('de-duplicates names that collide after sanitizing', async () => {
    const workbook = await buildWorkbook([
      sheetOf('Riesgo/Alto'),
      sheetOf('Riesgo:Alto'),
      sheetOf('Riesgo?Alto'),
    ]);
    expect(workbook!.worksheets.map((w) => w.name)).toEqual([
      'Riesgo-Alto',
      'Riesgo-Alto_2',
      'Riesgo-Alto_3',
    ]);
  });

  it('keeps de-duplicated names within 31 characters', async () => {
    const long = 'y'.repeat(40);
    const workbook = await buildWorkbook([sheetOf(long), sheetOf(long)]);
    const names = workbook!.worksheets.map((w) => w.name);
    expect(names[1]).toHaveLength(31);
    expect(names[1].endsWith('_2')).toBe(true);
  });

  it('does not collide with a real sheet already named like a dedupe suffix', async () => {
    const workbook = await buildWorkbook([
      sheetOf('Datos'),
      sheetOf('Datos_2'),
      sheetOf('Datos'),
    ]);
    expect(workbook!.worksheets.map((w) => w.name)).toEqual([
      'Datos',
      'Datos_2',
      'Datos_3',
    ]);
  });

  it('skips sheets with no rows and sheets with no columns', async () => {
    const workbook = await buildWorkbook([
      sheetOf('Vacia', []),
      { name: 'SinColumnas', columns: [], rows: ROWS },
      sheetOf('Alertas'),
    ]);
    expect(workbook!.worksheets.map((w) => w.name)).toEqual(['Alertas']);
  });

  it('returns null when every sheet is skipped', async () => {
    expect(await buildWorkbook([sheetOf('Vacia', [])])).toBeNull();
  });
});

describe('exportSheets', () => {
  it('returns true and calls the injected download exactly once on success', async () => {
    const download = vi.fn();
    const written = await exportSheets([sheetOf('Alertas')], {
      filename: 'report',
      download,
    });

    expect(written).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('passes a filename of <filename>_<ISO timestamp>.xlsx', async () => {
    const download = vi.fn();
    await exportSheets([sheetOf('Alertas')], { filename: 'report', download });

    const [, filename] = download.mock.calls[0];
    expect(filename).toMatch(
      /^report_\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.xlsx$/
    );
  });

  it('passes a non-empty blob carrying the xlsx MIME type', async () => {
    const download = vi.fn();
    await exportSheets([sheetOf('Alertas')], { filename: 'report', download });

    const [blob] = download.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('returns false and never calls download when every sheet is skipped', async () => {
    const download = vi.fn();
    const written = await exportSheets([sheetOf('Vacia', [])], {
      filename: 'report',
      download,
    });

    expect(written).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });
});
