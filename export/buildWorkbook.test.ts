import { describe, expect, it } from 'vitest';
import { buildWorkbook } from './buildWorkbook';
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
});
