# EasyVision Export-to-Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `EasyVisionExportButton` to `easyvision-ui` that exports one or more filter-linked tables to a single `.xlsx` file, one worksheet per table.

**Architecture:** Each `EasyVisionTable` registers an *export source* (a sheet name plus two lazy resolvers — visible exportable columns, and selection-aware rows) into a module-level `Map` keyed by the same `fullId` the state registry uses. The button names table ids, resolves them through the namespace context, and hands the collected sheets to a pure React-free `buildWorkbook`. Row fetching and column-visibility resolution are extracted out of `EasyVisionTable` into shared helpers so the table and the export source compute them identically rather than in parallel.

**Tech Stack:** TypeScript, React 18/19, ExcelJS 4, Vitest (new), tsup, zustand (existing registry), TanStack Table (existing).

**Spec:** `docs/superpowers/specs/2026-08-14-easyvision-export-design.md`

## Global Constraints

- **Repo:** `/home/oniros/sensei/easyvision-ui`. No other repo is touched. `nml-vision` migration is explicitly out of scope.
- **Commits:** never run `git commit` unattended. Each task ends by staging with `git add`; the suggested message is given, but the user performs the commit.
- **`tsconfig.json` has `strict: false`.** Don't add `strict`-dependent idioms; don't turn it on.
- **New runtime dependency:** `exceljs` `^4.4.0`, plain static import. No `file-saver` — downloads use `URL.createObjectURL` + `<a download>` + `revokeObjectURL`.
- **New devDependency:** `vitest` `^2.1.0`. Tests are node-environment only (no jsdom, no testing-library) — every tested module is pure.
- **Test files are colocated as `<name>.test.ts`** next to the module. They are outside `index.ts`'s import graph, so tsup never bundles them, and `package.json` `files: ["dist","README.md"]` keeps them unpublished.
- **Default labels are Spanish**, matching `DEFAULT_LABELS` in `table/EasyVisionTable.tsx:41-55`.
- **ARGB colour strings** are 8 hex digits, alpha first (`'FFCCCCCC'`).
- **Sheet name limit is 31 characters**; invalid characters are `* ? : \ / [ ]`.

### Two refinements to the spec

Both are implementation-level, decided while writing this plan. They are deliberate; don't "fix" them back.

1. **`ExportSource.getColumns()` returns `ExportColumnSpec[]`, not `EasyVisionColumn[]`.** The spec named the latter. Resolving to a flat `{header, getValue, getStyle}` shape at the source keeps `buildWorkbook` completely independent of table types and makes it testable with hand-written literals.
2. **The button is not disabled when no source resolves.** The spec said it should be. The source `Map` is not reactive, so a button rendering before its tables mount would latch disabled with nothing to re-trigger it. Instead an export with no resolvable sources produces no file and fires `onEmpty` — same user-visible outcome, no stale-state bug.

---

### Task 1: Test infrastructure, ExcelJS, and single-sheet workbook assembly

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `types/export.types.ts`
- Create: `export/buildWorkbook.ts`
- Test: `export/buildWorkbook.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ExportCellValue`, `ExportCellStyle`, `ExportColumnSpec<T>`, `SheetSpec<T>` types; `buildWorkbook(sheets: SheetSpec[]): Promise<ExcelJS.Workbook | null>`; `exportSheets(sheets, {filename, download?}): Promise<boolean>`; `downloadBlob(blob, filename): void`.

- [ ] **Step 1: Install dependencies**

```bash
cd /home/oniros/sensei/easyvision-ui
npm install exceljs@^4.4.0
npm install -D vitest@^2.1.0
```

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"` (alongside the existing `build`, `prepublishOnly`, `dev`):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create the vitest config**

The existing `vite.config.ts` sets `root: 'dev'` for the demo server, which would hide every test from discovery. Vitest gets its own config at the repo root.

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: that one sets `root: 'dev'` for the
// demo server, which would scope test discovery to the demo folder.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
});
```

- [ ] **Step 4: Create the export types**

Create `types/export.types.ts`:

```ts
import type { ReactNode } from 'react';

/** A value ExcelJS can write into a cell without further coercion. */
export type ExportCellValue = string | number | boolean | Date | null;

export interface ExportCellStyle {
  /** Solid background fill, ARGB (e.g. 'FFDC2626'). */
  fill?: string;
  /** Font colour, ARGB. */
  fontColor?: string;
  bold?: boolean;
}

/**
 * A fully-resolved sheet column: no dependency on table column types, so
 * `buildWorkbook` stays independent of how the columns were derived.
 */
export interface ExportColumnSpec<T = unknown> {
  header: string;
  getValue: (item: T) => ExportCellValue;
  getStyle?: (value: ExportCellValue, item: T) => ExportCellStyle | undefined;
}

export interface SheetSpec<T = unknown> {
  /** Pre-sanitizing name. `buildWorkbook` sanitizes and de-duplicates. */
  name: string;
  columns: ExportColumnSpec<T>[];
  rows: T[];
}

/**
 * What an EasyVisionTable registers so an export button can pull from it.
 * Both resolvers run at export time, never at registration time, so a column
 * toggle or a new multifilter query needs no re-registration.
 */
export interface ExportSource<T = unknown> {
  /** Default sheet name. The button's `sheetNames` map overrides it. */
  sheetName: string;
  getColumns: () => ExportColumnSpec<T>[];
  getRows: () => Promise<T[]>;
}

export interface ExportLabels {
  export: string;
  exporting: string;
}

export interface EasyVisionExportButtonProps {
  /**
   * Table ids, in sheet order. Local ids are resolved through the surrounding
   * namespace; an id already ending in `-table` is used verbatim.
   */
  tables: string[];
  /** Timestamp and `.xlsx` are appended. */
  filename: string;
  /** Per-table sheet-name override, keyed by the same id passed in `tables`. */
  sheetNames?: Record<string, string>;
  labels?: Partial<ExportLabels>;
  /** Fetch or workbook failure. The export is aborted whole; no partial file. */
  onError?: (error: unknown) => void;
  /** Nothing to export — no file was written. */
  onEmpty?: () => void;
  disabled?: boolean;
  className?: string;
  /** Replaces the default download icon. */
  icon?: ReactNode;
}
```

- [ ] **Step 5: Write the failing test**

Create `export/buildWorkbook.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test -- export/buildWorkbook.test.ts`
Expected: FAIL — `Failed to resolve import "./buildWorkbook"`.

- [ ] **Step 7: Implement `buildWorkbook`**

Create `export/buildWorkbook.ts`:

```ts
import ExcelJS from 'exceljs';
import type { SheetSpec } from '../types/export.types';

const HEADER_FILL_ARGB = 'FFCCCCCC';
const MIN_COLUMN_WIDTH = 10;
const COLUMN_WIDTH_PADDING = 2;
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExportSheetsOptions {
  /** Timestamp and `.xlsx` are appended. */
  filename: string;
  /** Injectable for tests. Defaults to an object-URL anchor click. */
  download?: (blob: Blob, filename: string) => void;
}

/** Native download — no file-saver needed. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.columns.forEach((column) => {
    let longest = 0;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length =
        cell.value == null ? MIN_COLUMN_WIDTH : String(cell.value).length;
      if (length > longest) longest = length;
    });
    column.width =
      longest < MIN_COLUMN_WIDTH ? MIN_COLUMN_WIDTH : longest + COLUMN_WIDTH_PADDING;
  });
};

/**
 * Assemble sheets into a workbook. Returns `null` when nothing was worth
 * writing, so callers can distinguish "no file" from "empty file".
 */
export async function buildWorkbook<T>(
  sheets: SheetSpec<T>[]
): Promise<ExcelJS.Workbook | null> {
  if (sheets.length === 0) return null;

  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    const headerRow = worksheet.addRow(sheet.columns.map((c) => c.header));
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_FILL_ARGB },
      };
      cell.font = { bold: true };
    });

    for (const item of sheet.rows) {
      const values = sheet.columns.map((column) => column.getValue(item));
      const row = worksheet.addRow(values);
      sheet.columns.forEach((column, index) => {
        const style = column.getStyle?.(values[index], item);
        if (!style) return;
        const cell = row.getCell(index + 1);
        if (style.fill) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: style.fill },
          };
        }
        if (style.fontColor || style.bold) {
          cell.font = {
            bold: !!style.bold,
            ...(style.fontColor ? { color: { argb: style.fontColor } } : {}),
          };
        }
      });
    }

    autoFitColumns(worksheet);
  }

  return workbook;
}

/** Build and hand the file to the browser. Returns false when no file was written. */
export async function exportSheets<T>(
  sheets: SheetSpec<T>[],
  options: ExportSheetsOptions
): Promise<boolean> {
  const workbook = await buildWorkbook(sheets);
  if (!workbook) return false;

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME });
  const filename = `${options.filename}_${new Date().toISOString()}.xlsx`;
  (options.download ?? downloadBlob)(blob, filename);
  return true;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- export/buildWorkbook.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 9: Stage**

```bash
git add package.json package-lock.json vitest.config.ts types/export.types.ts export/buildWorkbook.ts export/buildWorkbook.test.ts
# suggested message: feat(export): add buildWorkbook with vitest and exceljs
```

---

### Task 2: Sheet naming, multi-sheet output, and empty-sheet skipping

**Files:**
- Modify: `export/buildWorkbook.ts`
- Test: `export/buildWorkbook.test.ts`

**Interfaces:**
- Consumes: `buildWorkbook`, `SheetSpec` from Task 1.
- Produces: `sanitizeSheetName(name: string): string`. `buildWorkbook` now skips unusable sheets and de-duplicates names.

ExcelJS throws on a duplicate worksheet name, so de-duplication is a crash guard, not a nicety. It tracks *final* names rather than base names, because a de-duplicated candidate can itself collide with a real sheet literally named `Clientes_2`.

- [ ] **Step 1: Write the failing tests**

First widen the existing import at the top of `export/buildWorkbook.test.ts`:

```ts
import { buildWorkbook, sanitizeSheetName } from './buildWorkbook';
```

Then append to the same file (`Row`, `ROWS` and the `SheetSpec` type import are already in scope from Task 1):

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- export/buildWorkbook.test.ts`
Expected: FAIL — `sanitizeSheetName` is not exported; multi-sheet and skipping tests fail.

- [ ] **Step 3: Implement naming and skipping**

In `export/buildWorkbook.ts`, add below the existing constants:

```ts
const INVALID_SHEET_CHARS = /[*?:\\/[\]]/g;
const MAX_SHEET_NAME = 31;
const FALLBACK_SHEET_NAME = 'Hoja';

export const sanitizeSheetName = (name: string): string =>
  name.replace(INVALID_SHEET_CHARS, '-').substring(0, MAX_SHEET_NAME) ||
  FALLBACK_SHEET_NAME;

/**
 * ExcelJS throws on duplicate worksheet names, so this must always return a
 * name not already used. Tracking final names (not bases) means a generated
 * `Foo_2` cannot collide with a source sheet genuinely called `Foo_2`.
 */
const uniqueSheetName = (raw: string, taken: Set<string>): string => {
  const base = sanitizeSheetName(raw);
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const suffix = `_${n}`;
    const candidate = base.substring(0, MAX_SHEET_NAME - suffix.length) + suffix;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
};
```

Then replace the opening of `buildWorkbook` — everything from `if (sheets.length === 0)` down to and including the `for (const sheet of sheets) {` line — with:

```ts
  const usable = sheets.filter(
    (sheet) => sheet.rows.length > 0 && sheet.columns.length > 0
  );
  if (usable.length === 0) return null;

  const workbook = new ExcelJS.Workbook();
  const takenNames = new Set<string>();

  for (const sheet of usable) {
```

and change the `addWorksheet` line to:

```ts
    const worksheet = workbook.addWorksheet(uniqueSheetName(sheet.name, takenNames));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- export/buildWorkbook.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Stage**

```bash
git add export/buildWorkbook.ts export/buildWorkbook.test.ts
# suggested message: feat(export): multi-sheet output with sheet-name sanitizing and dedupe
```

---

### Task 3: Column export props and `EasyVisionColumn` → `ExportColumnSpec`

**Files:**
- Modify: `types/table.types.ts:36-89`
- Create: `export/exportColumns.ts`
- Test: `export/exportColumns.test.ts`

**Interfaces:**
- Consumes: `ExportCellValue`, `ExportCellStyle`, `ExportColumnSpec` from Task 1; `getByPath` from `lib/isNestedAccessor.ts`.
- Produces: `toExportCellValue(raw: unknown): ExportCellValue`; `isExportable<T>(column): boolean`; `exportHeaderOf<T>(column): string`; `toExportColumns<T>(columns: EasyVisionColumn<T>[], isVisible: (field: string) => boolean): ExportColumnSpec<T>[]`.

- [ ] **Step 1: Add the export props to both column variants**

In `types/table.types.ts`, add this import at the top:

```ts
import type { ExportCellStyle, ExportCellValue } from './export.types';
```

Then add these four properties to **both** members of the `EasyVisionColumn<T>` union — the `type?: 'data'` variant (currently ending at `resizable?: boolean;`, line 73) and the `type: 'ui'` variant (ending at line 88). Paste the identical block into each:

```ts
      /**
       * Header text in an exported sheet. Defaults to `header` when it is a
       * plain string, otherwise to `field`.
       */
      exportHeader?: string;
      /**
       * Cell value in an exported sheet. Defaults to the value at `field`,
       * with arrays joined by ", ". Use this to format dates, map codes to
       * labels, or reach into fields the column doesn't render.
       */
      exportValue?: (item: T) => ExportCellValue;
      /**
       * Per-cell styling in an exported sheet. Return ARGB colour strings
       * (alpha first, e.g. 'FFDC2626'). Return undefined to leave the cell
       * unstyled.
       */
      exportStyle?: (value: ExportCellValue, item: T) => ExportCellStyle | undefined;
      /**
       * Include this column in exports. Defaults to true for `data` columns
       * and false for `ui` columns — set it true on a `ui` column alongside an
       * `exportValue` to export a computed column.
       */
      exportable?: boolean;
```

- [ ] **Step 2: Write the failing test**

Create `export/exportColumns.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- export/exportColumns.test.ts`
Expected: FAIL — `Failed to resolve import "./exportColumns"`.

- [ ] **Step 4: Implement the column resolver**

Create `export/exportColumns.ts`:

```ts
import { getByPath } from '../lib/isNestedAccessor';
import type { EasyVisionColumn } from '../types/table.types';
import type { ExportCellValue, ExportColumnSpec } from '../types/export.types';

/** Coerce an arbitrary row value into something a cell can hold. */
export const toExportCellValue = (raw: unknown): ExportCellValue => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw instanceof Date) return raw;
  const kind = typeof raw;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') {
    return raw as ExportCellValue;
  }
  return String(raw);
};

/** `data` columns export by default; `ui` columns must opt in. */
export const isExportable = <T>(column: EasyVisionColumn<T>): boolean =>
  column.exportable ?? column.type !== 'ui';

export const exportHeaderOf = <T>(column: EasyVisionColumn<T>): string =>
  column.exportHeader ??
  (typeof column.header === 'string' ? column.header : column.field);

/**
 * Flatten table columns into sheet columns, keeping the declared order.
 * `isVisible` is supplied by the caller so this stays free of slice access.
 */
export function toExportColumns<T>(
  columns: EasyVisionColumn<T>[],
  isVisible: (field: string) => boolean
): ExportColumnSpec<T>[] {
  return columns
    .filter((column) => isExportable(column) && isVisible(column.field))
    .map((column) => {
      const exportValue = column.exportValue;
      const exportStyle = column.exportStyle;
      const field = column.field;
      const isUi = column.type === 'ui';
      return {
        header: exportHeaderOf(column),
        getValue: (item: T): ExportCellValue => {
          if (exportValue) return toExportCellValue(exportValue(item));
          // A `ui` column has no underlying value; opting it in without an
          // `exportValue` yields an empty column rather than a crash.
          if (isUi) return null;
          return toExportCellValue(getByPath(item, field));
        },
        getStyle: exportStyle
          ? (value: ExportCellValue, item: T) => exportStyle(value, item)
          : undefined,
      };
    });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- export/exportColumns.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (The union additions must compile against every existing `columns={...}` in `demo/`; note `demo` is excluded from tsconfig, so also check `dev/`.)

- [ ] **Step 7: Stage**

```bash
git add types/table.types.ts export/exportColumns.ts export/exportColumns.test.ts
# suggested message: feat(export): column export props and EasyVisionColumn resolution
```

---

### Task 4: Extract column-visibility resolution

**Files:**
- Create: `table/columnVisibility.ts`
- Modify: `table/EasyVisionTable.tsx:351-369`
- Test: `table/columnVisibility.test.ts`

**Interfaces:**
- Consumes: `EasyVisionColumn` from `types/table.types.ts`.
- Produces: `resolveColumnVisibility<T>(columns, sliceVisibility): Record<string, boolean>`; `isColumnVisible(visibility, field): boolean`.

The merge currently lives inline in the table. The export source needs the identical computation; extracting it means one definition rather than two that can drift.

- [ ] **Step 1: Write the failing test**

Create `table/columnVisibility.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- table/columnVisibility.test.ts`
Expected: FAIL — `Failed to resolve import "./columnVisibility"`.

- [ ] **Step 3: Implement the helper**

Create `table/columnVisibility.ts`:

```ts
import type { EasyVisionColumn } from '../types/table.types';

/**
 * Merge declared `initiallyHidden` defaults with the user's toggles from the
 * table slice.
 *
 * Defaults are *not* baked into the slice; they're merged here at read time.
 * That way a column added to `columns` after the slice was persisted still
 * picks up its declared default — had we seeded the slice with defaults, the
 * missing key for the new column would silently render it visible.
 */
export function resolveColumnVisibility<T>(
  columns: EasyVisionColumn<T>[],
  sliceVisibility: Record<string, boolean>
): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  for (const column of columns) {
    if (column.initiallyHidden) defaults[column.field] = false;
  }
  return { ...defaults, ...sliceVisibility };
}

/** A column is visible unless explicitly set to false. */
export const isColumnVisible = (
  visibility: Record<string, boolean>,
  field: string
): boolean => visibility[field] !== false;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- table/columnVisibility.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Rewire the table to use it**

In `table/EasyVisionTable.tsx`, add to the imports (next to the existing `./useTableData` import):

```ts
import { resolveColumnVisibility } from './columnVisibility';
```

Replace lines 351-369 — the block comment, `visibilityDefaults`, and `columnVisibility` — with:

```ts
  // Column visibility / sizing both live in the table slice so they survive
  // unmount when `persist` is on (same lifetime as page / sort / selection).
  // The defaults merge is shared with the export path via `columnVisibility.ts`
  // so an export sees exactly the columns the table renders.
  const columnVisibility = useMemo<VisibilityState>(
    () => resolveColumnVisibility(columns, slice.columnVisibility),
    [columns, slice.columnVisibility]
  );
```

- [ ] **Step 6: Typecheck and verify the demo still behaves**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`
Expected: the demo opens on port 5180. On the "3. Tables" card, open the **Columnas** menu on the local table, hide a column, confirm it disappears and the menu checkbox stays unchecked. Stop the server.

- [ ] **Step 7: Stage**

```bash
git add table/columnVisibility.ts table/columnVisibility.test.ts table/EasyVisionTable.tsx
# suggested message: refactor(table): extract column visibility merge for reuse by export
```

---

### Task 5: Extract the paginate-everything fetch loop

**Files:**
- Create: `table/fetchAllRows.ts`
- Modify: `table/EasyVisionTable.tsx:186-274`
- Test: `table/fetchAllRows.test.ts`

**Interfaces:**
- Consumes: `ApiFetchParams`, `ApiFetchResult` from `types/table.types.ts`; `MultifilterQuery` from `types/multifilter.types.ts`.
- Produces: `FETCH_ALL_PAGE_SIZE: 200`; `mergeFilters(externalFilter, multifilterQuery): MultifilterQuery | undefined`; `fetchAllRows<T>(params): Promise<T[] | null>`.

`resolveEagerAll` (lines 228-274) already paginates the fetcher with the merged filter; the export needs the same. Extract, then have both call it — the filter-merge rule (external `where` first, multifilter `where` second so it wins on key collisions) then has one home.

- [ ] **Step 1: Write the failing test**

Create `table/fetchAllRows.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchAllRows, mergeFilters } from './fetchAllRows';
import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';

interface Row {
  id: string;
}

/** Fake API over a fixed dataset, recording the params it was called with. */
const makeFetcher = (total: number) => {
  const calls: ApiFetchParams[] = [];
  const all: Row[] = Array.from({ length: total }, (_, i) => ({ id: String(i) }));
  const fetchData = async (params: ApiFetchParams): Promise<ApiFetchResult<Row>> => {
    calls.push(params);
    const start = (params.page - 1) * params.itemsPerPage;
    return { rows: all.slice(start, start + params.itemsPerPage), totalCount: total };
  };
  return { fetchData, calls };
};

describe('mergeFilters', () => {
  it('returns undefined when neither side has anything', () => {
    expect(mergeFilters(undefined, undefined)).toBeUndefined();
  });

  it('lets the multifilter win on colliding where keys', () => {
    const merged = mergeFilters(
      { where: { status: 'OPEN', clientId: 'a' } },
      { where: { status: 'CLOSED' }, order: ['created DESC'] }
    );
    expect(merged).toEqual({
      where: { clientId: 'a', status: 'CLOSED' },
      order: ['created DESC'],
    });
  });

  it('keeps the external where when the multifilter has none', () => {
    expect(mergeFilters({ where: { a: 1 } }, undefined)).toEqual({ where: { a: 1 } });
  });
});

describe('fetchAllRows', () => {
  it('pages until the known total is collected', async () => {
    const { fetchData, calls } = makeFetcher(450);
    const rows = await fetchAllRows({ fetchData, filter: undefined, sort: null });

    expect(rows).toHaveLength(450);
    expect(calls.map((c) => c.page)).toEqual([1, 2, 3]);
    expect(calls[0].itemsPerPage).toBe(200);
  });

  it('stops on a short page even if the total disagrees', async () => {
    const fetchData = vi.fn(async () => ({
      rows: [{ id: 'a' }],
      totalCount: 9999,
    }));
    const rows = await fetchAllRows({ fetchData, filter: undefined, sort: null });

    expect(rows).toEqual([{ id: 'a' }]);
    expect(fetchData).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when there is nothing to fetch', async () => {
    const { fetchData } = makeFetcher(0);
    expect(await fetchAllRows({ fetchData, filter: undefined, sort: null })).toEqual([]);
  });

  it('forwards sort, filter and idsOnly on every page', async () => {
    const { fetchData, calls } = makeFetcher(250);
    const filter = { where: { status: 'OPEN' } };
    const sort = { column: 'created', descending: true };
    await fetchAllRows({ fetchData, filter, sort, idsOnly: true });

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.filter).toBe(filter);
      expect(call.sort).toBe(sort);
      expect(call.idsOnly).toBe(true);
    }
  });

  it('aborts and returns null when shouldContinue turns false', async () => {
    const { fetchData, calls } = makeFetcher(1000);
    let allowed = 2;
    const rows = await fetchAllRows({
      fetchData,
      filter: undefined,
      sort: null,
      shouldContinue: () => allowed-- > 0,
    });

    expect(rows).toBeNull();
    expect(calls.length).toBeLessThan(5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- table/fetchAllRows.test.ts`
Expected: FAIL — `Failed to resolve import "./fetchAllRows"`.

- [ ] **Step 3: Implement the helper**

Create `table/fetchAllRows.ts`:

```ts
import type { ApiFetchParams, ApiFetchResult } from '../types/table.types';
import type { MultifilterQuery } from '../types/multifilter.types';

/** Page size used when materializing an entire result set. */
export const FETCH_ALL_PAGE_SIZE = 200;

/**
 * Combine an externally-driven filter with the multifilter's confirmed query.
 * The multifilter is spread second so it wins on colliding `where` keys —
 * a bound filter panel should be able to override a page-level default.
 */
export const mergeFilters = (
  externalFilter: { where?: Record<string, unknown> } | undefined,
  multifilterQuery: MultifilterQuery | undefined
): MultifilterQuery | undefined =>
  externalFilter || multifilterQuery
    ? {
        ...multifilterQuery,
        where: {
          ...(externalFilter?.where ?? {}),
          ...(multifilterQuery?.where ?? {}),
        },
      }
    : undefined;

export interface FetchAllRowsParams<T> {
  fetchData: (params: ApiFetchParams) => Promise<ApiFetchResult<T>>;
  filter: MultifilterQuery | undefined;
  sort: ApiFetchParams['sort'];
  /** Hint adapters they may shrink the payload to ids only. */
  idsOnly?: boolean;
  pageSize?: number;
  /** Return false to abort — e.g. a newer request superseded this one. */
  shouldContinue?: () => boolean;
}

/**
 * Page through `fetchData` until the whole matching set is in memory.
 * Returns null when aborted via `shouldContinue`, so callers can tell an
 * abort apart from a genuinely empty result.
 */
export async function fetchAllRows<T>({
  fetchData,
  filter,
  sort,
  idsOnly = false,
  pageSize = FETCH_ALL_PAGE_SIZE,
  shouldContinue,
}: FetchAllRowsParams<T>): Promise<T[] | null> {
  const collected: T[] = [];
  let knownTotal = Infinity;

  for (let page = 1; collected.length < knownTotal; page++) {
    const result = await fetchData({
      page,
      itemsPerPage: pageSize,
      sort,
      filter,
      idsOnly,
    });
    if (shouldContinue && !shouldContinue()) return null;
    knownTotal = result.totalCount;
    collected.push(...result.rows);
    if (result.rows.length < pageSize) break;
  }

  return collected;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- table/fetchAllRows.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Rewire `runFetch` to use `mergeFilters`**

In `table/EasyVisionTable.tsx`, add to the imports:

```ts
import { fetchAllRows, mergeFilters } from './fetchAllRows';
```

In `runFetch` (lines 186-218), replace the inline merge — from the `// Merge externally-driven filter` comment through the `const merged = ... : undefined;` expression — with:

```ts
      const merged = mergeFilters(externalFilter, lastSnapshotRef.current?.query);
```

- [ ] **Step 6: Rewire `resolveEagerAll` to use `fetchAllRows`**

Replace the whole body of `resolveEagerAll` (lines 228-274) with:

```ts
  const resolveEagerAll = useCallback(async () => {
    if (!fetchData) return;
    const collectRows = selectAllResolution === 'eager';
    const seq = ++eagerSeqRef.current;
    setIsResolvingEager(true);
    try {
      const fetched = await fetchAllRows<T>({
        fetchData,
        filter: mergeFilters(externalFilter, lastSnapshotRef.current?.query),
        sort,
        idsOnly: !collectRows,
        shouldContinue: () => seq === eagerSeqRef.current,
      });
      if (fetched === null || seq !== eagerSeqRef.current) return;

      const ids: string[] = [];
      const rowsAcc: T[] = [];
      for (const row of fetched) {
        const rid = getRowId(row);
        if (rid) {
          ids.push(rid);
          if (collectRows) rowsAcc.push(row);
        }
      }
      setEagerAllIds(ids);
      if (collectRows) setEagerAllRows(rowsAcc);
    } finally {
      if (seq === eagerSeqRef.current) setIsResolvingEager(false);
    }
  }, [fetchData, externalFilter, sort, getRowId, selectAllResolution]);
```

- [ ] **Step 7: Typecheck and verify eager select-all still works**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests pass.

Run: `npm run dev`
Expected: on the demo's `apiTableEagerIds` table, tick the select-all header checkbox and switch its chevron to "Seleccionar todo". The banner must report the full row count (not just the current page), and column sort headers must lock while the wildcard selection is active. Stop the server.

- [ ] **Step 8: Stage**

```bash
git add table/fetchAllRows.ts table/fetchAllRows.test.ts table/EasyVisionTable.tsx
# suggested message: refactor(table): extract fetchAllRows and mergeFilters from resolveEagerAll
```

---

### Task 6: Selection predicate

**Files:**
- Create: `table/applySelection.ts`
- Test: `table/applySelection.test.ts`

**Interfaces:**
- Consumes: `TableSelection` from `store/slice-types.ts`.
- Produces: `applySelection<T>(rows: T[], selection: TableSelection, getRowId: (row: T) => string): T[]`.

This is the "selection if any, else everything matching" rule from the spec, as one function over an already-materialized row set. Filtering a full set rather than special-casing "the rows are already in `apiRows`" is what makes a selection spanning never-loaded pages come out right.

- [ ] **Step 1: Write the failing test**

Create `table/applySelection.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- table/applySelection.test.ts`
Expected: FAIL — `Failed to resolve import "./applySelection"`.

- [ ] **Step 3: Implement the predicate**

Create `table/applySelection.ts`:

```ts
import type { TableSelection } from '../store/slice-types';

/**
 * Narrow a fully-materialized row set to what the user actually selected:
 * the ticked rows when there is a selection, everything otherwise.
 *
 * Filtering a full set — rather than reading whatever happens to sit in the
 * current page's state — is what makes a selection spanning pages that were
 * never loaded come out right.
 */
export function applySelection<T>(
  rows: T[],
  selection: TableSelection,
  getRowId: (row: T) => string
): T[] {
  if (selection.scope === 'all') {
    const except = selection.exceptIds;
    if (!except || Object.keys(except).length === 0) return rows;
    return rows.filter((row) => !except[getRowId(row)]);
  }

  const ids = selection.ids;
  if (!ids || Object.keys(ids).length === 0) return rows;
  return rows.filter((row) => ids[getRowId(row)]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- table/applySelection.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Stage**

```bash
git add table/applySelection.ts table/applySelection.test.ts
# suggested message: feat(table): add applySelection predicate for exports
```

---

### Task 7: Export source registry

**Files:**
- Create: `export/sources.ts`
- Test: `export/sources.test.ts`

**Interfaces:**
- Consumes: `ExportSource` from Task 1.
- Produces: `registerExportSource(fullId, source): void`; `unregisterExportSource(fullId): void`; `getExportSource(fullId): ExportSource | undefined`; `clearExportSources(): void`.

Deliberately a module-level `Map`, not part of `easyVisionRegistry`: the registry holds serializable slice state that `patch` / `drop` / persistence operate on, and export sources are closures over fetchers that cannot round-trip. Same `fullId` keys, separate container.

- [ ] **Step 1: Write the failing test**

Create `export/sources.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExportSources,
  getExportSource,
  registerExportSource,
  unregisterExportSource,
} from './sources';
import type { ExportSource } from '../types/export.types';

const sourceNamed = (sheetName: string): ExportSource => ({
  sheetName,
  getColumns: () => [],
  getRows: async () => [],
});

describe('export source registry', () => {
  beforeEach(() => clearExportSources());

  it('returns undefined for an unknown id', () => {
    expect(getExportSource('nope-table')).toBeUndefined();
  });

  it('round-trips a registered source by fullId', () => {
    const source = sourceNamed('Alertas');
    registerExportSource('alerts-table', source);
    expect(getExportSource('alerts-table')).toBe(source);
  });

  it('keeps namespaced ids distinct', () => {
    registerExportSource('page-table.alerts-table', sourceNamed('A'));
    registerExportSource('alerts-table', sourceNamed('B'));
    expect(getExportSource('page-table.alerts-table')!.sheetName).toBe('A');
    expect(getExportSource('alerts-table')!.sheetName).toBe('B');
  });

  it('replaces a source registered twice under the same id', () => {
    registerExportSource('alerts-table', sourceNamed('Vieja'));
    registerExportSource('alerts-table', sourceNamed('Nueva'));
    expect(getExportSource('alerts-table')!.sheetName).toBe('Nueva');
  });

  it('forgets a source after unregister', () => {
    registerExportSource('alerts-table', sourceNamed('Alertas'));
    unregisterExportSource('alerts-table');
    expect(getExportSource('alerts-table')).toBeUndefined();
  });

  it('tolerates unregistering an id that was never registered', () => {
    expect(() => unregisterExportSource('ghost-table')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- export/sources.test.ts`
Expected: FAIL — `Failed to resolve import "./sources"`.

- [ ] **Step 3: Implement the registry**

Create `export/sources.ts`:

```ts
import type { ExportSource } from '../types/export.types';

/**
 * Export sources live here rather than in `easyVisionRegistry` because they
 * are closures over fetchers, not serializable slice state — putting them in
 * the registry would mean teaching `patch` / `drop` / persistence about values
 * that cannot round-trip. Keys are the same `fullId` the registry uses, so
 * namespace resolution is identical on both sides.
 */
const sources = new Map<string, ExportSource<any>>();

export const registerExportSource = (
  fullId: string,
  source: ExportSource<any>
): void => {
  sources.set(fullId, source);
};

export const unregisterExportSource = (fullId: string): void => {
  sources.delete(fullId);
};

export const getExportSource = (
  fullId: string
): ExportSource<any> | undefined => sources.get(fullId);

/** Test seam. Not exported from the package index. */
export const clearExportSources = (): void => {
  sources.clear();
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- export/sources.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Stage**

```bash
git add export/sources.ts export/sources.test.ts
# suggested message: feat(export): add export source registry
```

---

### Task 8: `EasyVisionTable` registers its export source

**Files:**
- Modify: `table/EasyVisionTable.tsx` (imports; a new effect after the `columnVisibility` memo)

**Interfaces:**
- Consumes: `registerExportSource` / `unregisterExportSource` (Task 7); `toExportColumns` (Task 3); `isColumnVisible` (Task 4); `fetchAllRows` / `mergeFilters` (Task 5); `applySelection` (Task 6).
- Produces: every mounted `EasyVisionTable` is addressable by the export button at its `fullId`.

Both resolvers read a ref updated on every render, so neither prop-identity churn nor a column toggle needs a re-registration.

Everything the ref captures must already be in scope, and the last of those is `isLoading` at line 323. **Insert the whole block immediately after line 323** — i.e. after `const isLoading = isLoadingProp || apiLoading;` and before the `tanstackColumns` memo.

- [ ] **Step 1: Add the imports**

In `table/EasyVisionTable.tsx`:

```ts
import { applySelection } from './applySelection';
import { isColumnVisible } from './columnVisibility';
import { registerExportSource, unregisterExportSource } from '../export/sources';
import { toExportColumns } from '../export/exportColumns';
```

- [ ] **Step 2: Add the ref and registration effect**

Insert immediately after `const isLoading = isLoadingProp || apiLoading;` (line 323):

```ts
  // Export wiring. Everything the export needs is read through this ref at
  // export time rather than captured at registration time, so a column toggle,
  // a new multifilter query, or a fresh fetcher identity all take effect
  // without re-registering.
  const exportStateRef = useRef({
    columns,
    columnVisibility,
    selection,
    fetchData,
    externalFilter,
    sort,
    filteredData,
    isApi,
    getRowId,
    sheetName: id,
  });
  exportStateRef.current = {
    columns,
    columnVisibility,
    selection,
    fetchData,
    externalFilter,
    sort,
    filteredData,
    isApi,
    getRowId,
    sheetName: id,
  };

  useEffect(() => {
    registerExportSource(fullId, {
      sheetName: id,
      getColumns: () => {
        const state = exportStateRef.current;
        return toExportColumns(state.columns, (field) =>
          isColumnVisible(state.columnVisibility, field)
        );
      },
      getRows: async () => {
        const state = exportStateRef.current;
        let all: T[];
        if (state.isApi && state.fetchData) {
          all =
            (await fetchAllRows<T>({
              fetchData: state.fetchData,
              filter: mergeFilters(
                state.externalFilter,
                lastSnapshotRef.current?.query
              ),
              sort: state.sort,
            })) ?? [];
        } else {
          // Local mode already holds the filtered set in memory.
          all = state.filteredData ?? [];
        }
        return applySelection(all, state.selection, state.getRowId);
      },
    });
    return () => unregisterExportSource(fullId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullId, id]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `getColumns` complains about the generic, the source is registered as `ExportSource<any>` — the cast is `registerExportSource(fullId, { ... } as ExportSource<T>)`.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — every test from Tasks 1-7.

- [ ] **Step 5: Stage**

```bash
git add table/EasyVisionTable.tsx
# suggested message: feat(table): register an export source per mounted table
```

---

### Task 9: `EasyVisionExportButton` and package exports

**Files:**
- Create: `export/EasyVisionExportButton.tsx`
- Modify: `index.ts`

**Interfaces:**
- Consumes: `getExportSource` (Task 7); `exportSheets` (Tasks 1-2); `EasyVisionExportButtonProps`, `ExportLabels`, `SheetSpec` (Task 1); `useParentFullId` from `store/NamespaceContext`; `childFullIdOf` from `store/namespace`.
- Produces: the public `EasyVisionExportButton` component plus the package's export surface.

Sheets are resolved **sequentially**, not with `Promise.all`: each source may page through a large result set, and firing several such loops at once against the same API invites rate-limiting.

- [ ] **Step 1: Implement the button**

Create `export/EasyVisionExportButton.tsx`:

```tsx
import * as React from 'react';
import { useCallback, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useParentFullId } from '../store/NamespaceContext';
import { childFullIdOf } from '../store/namespace';
import { getExportSource } from './sources';
import { exportSheets } from './buildWorkbook';
import type {
  EasyVisionExportButtonProps,
  ExportLabels,
  SheetSpec,
} from '../types/export.types';

const DEFAULT_LABELS: ExportLabels = {
  export: 'Exportar',
  exporting: 'Exportando...',
};

const TABLE_SUFFIX = '-table';

export function EasyVisionExportButton({
  tables,
  filename,
  sheetNames,
  labels: labelOverrides,
  onError,
  onEmpty,
  disabled = false,
  className,
  icon,
}: EasyVisionExportButtonProps) {
  const labels: ExportLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const parentFullId = useParentFullId();
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = useCallback(async () => {
    setIsExporting(true);
    try {
      const sheets: SheetSpec[] = [];
      // Sequential on purpose: each source may page through a large result
      // set, and running those loops concurrently invites rate-limiting.
      for (const tableId of tables) {
        const fullId = tableId.endsWith(TABLE_SUFFIX)
          ? tableId
          : childFullIdOf(parentFullId, tableId, 'table');
        const source = getExportSource(fullId);
        if (!source) continue;
        sheets.push({
          name: sheetNames?.[tableId] ?? source.sheetName,
          columns: source.getColumns(),
          rows: await source.getRows(),
        });
      }

      const written = await exportSheets(sheets, { filename });
      if (!written) onEmpty?.();
    } catch (error) {
      // Abort whole rather than ship a workbook silently missing a sheet.
      onError?.(error);
    } finally {
      setIsExporting(false);
    }
  }, [tables, parentFullId, sheetNames, filename, onEmpty, onError]);

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled || isExporting}
      onClick={handleClick}
    >
      {isExporting ? (
        <Loader2 className="ev-export-icon animate-spin" />
      ) : (
        icon ?? <Download className="ev-export-icon" />
      )}
      {isExporting ? labels.exporting : labels.export}
    </Button>
  );
}
```

- [ ] **Step 2: Add the icon spacing rule**

In `table/EasyVisionTable.css`, next to the existing `.ev-cv-icon` rule, add:

```css
.ev-export-icon {
  margin-right: 0.5rem;
  height: 1rem;
  width: 1rem;
}
```

- [ ] **Step 3: Export from the package index**

In `index.ts`, add after the `EasyVisionTable` export line:

```ts
export { EasyVisionExportButton } from './export/EasyVisionExportButton';
export {
  buildWorkbook,
  exportSheets,
  sanitizeSheetName,
  downloadBlob,
} from './export/buildWorkbook';
export { toExportColumns } from './export/exportColumns';
```

and after the table type exports:

```ts
export type {
  ExportSource,
  ExportColumnSpec,
  ExportCellValue,
  ExportCellStyle,
  SheetSpec,
  ExportLabels,
  EasyVisionExportButtonProps,
} from './types/export.types';
```

`clearExportSources` stays unexported — it is a test seam.

- [ ] **Step 4: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` regenerate; `postbuild.cjs` renames the CSS without error.

- [ ] **Step 5: Stage**

```bash
git add export/EasyVisionExportButton.tsx table/EasyVisionTable.css index.ts
# suggested message: feat(export): add EasyVisionExportButton and package exports
```

---

### Task 10: Demo and README

**Files:**
- Modify: `demo/EasyVisionDemoPage.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: a runnable two-table export and the public documentation.

- [ ] **Step 1: Add the demo export button**

In `demo/EasyVisionDemoPage.tsx`, add `EasyVisionExportButton` to the import from `'../index'` on line 8.

Replace `TABLE_COLUMNS` (lines 200-209) so the demo exercises `exportValue` and `exportStyle`. Note `amount` is already `initiallyHidden`, so it is absent from exports by default — that is the visibility rule demonstrating itself.

```ts
const LEVEL_LABELS: Record<DemoRow['level'], string> = {
  CRITICAL: 'Crítico',
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
};

const TABLE_COLUMNS: EasyVisionColumn<DemoRow>[] = [
  { field: 'created', header: 'Fecha' },
  { field: 'client.name', header: 'Cliente' },
  { field: 'client.sector', header: 'Sector', sortable: true },
  { field: 'client.country', header: 'País' },
  {
    field: 'level',
    header: 'Nivel',
    // Exports the readable label instead of the raw enum.
    exportValue: (row) => LEVEL_LABELS[row.level],
  },
  { field: 'status', header: 'Estado' },
  {
    field: 'score',
    header: 'Score',
    exportStyle: (value) =>
      typeof value === 'number' && value >= 3.5
        ? { fill: 'FF991B1B', fontColor: 'FFFFFFFF', bold: true }
        : undefined,
  },
  { field: 'amount', header: 'Importe', initiallyHidden: true },
];
```

Then insert this block immediately before the closing `</EasyVisionCard>` of the tables section (after the `apiTableEagerIds` block that starts at line 342):

```tsx
      <div className="mt-4">
        <h3 className="text-sm font-medium mb-2">
          One button, two sheets — hide a column via <code>Columnas</code> and it
          leaves the sheet too
        </h3>
        <EasyVisionExportButton
          tables={['localTable', 'apiTable']}
          sheetNames={{ localTable: 'Local', apiTable: 'API' }}
          filename="easyvision-demo"
          onEmpty={() => window.alert('Nada que exportar')}
          onError={(error) => window.alert(String(error))}
        />
      </div>
```

- [ ] **Step 2: Verify the demo end to end**

Run: `npm run dev`

Check each of these on the "3. Tables" card:

1. Click **Exportar** with nothing selected → a file downloads with two sheets, `Local` and `API`, each holding every filtered row. `Importe` is absent from both (it is `initiallyHidden`); `Nivel` reads `Crítico` / `Alto` / … not the raw enum; scores at or above 3.5 have a dark red fill.
2. Tick two rows in the local table, export → the `Local` sheet holds exactly those two rows; `API` is unchanged.
3. Open **Columnas** on the local table, hide `Sector`, export → `Sector` is gone from the `Local` sheet and still present in `API`.
4. Open **Columnas** on the local table, tick `Importe` on, export → `Importe` now appears in `Local` only.
5. Hide *every* column on the local table, export → the file has only the `API` sheet.
6. Run a multifilter query on the local table, then export → the `Local` sheet holds only the matching rows.
7. Narrow the browser until a `largeScreensOnly` column disappears from the screen, export → that column is **still** in the sheet. (No demo column sets this today; add `largeScreensOnly: true` to `client.country` to check, then revert.)

Stop the server.

- [ ] **Step 3: Document it in the README**

Add an `## EasyVisionExportButton` section after the `## EasyVisionTable` section (which ends before `## Migration cookbook`, line 1219), and add it to the table of contents at line 16. Cover, in the style of the existing sections:

- Minimal usage — one button, two tables, the `tables` / `filename` / `sheetNames` props.
- The props table, matching `EasyVisionExportButtonProps` field for field.
- **What gets exported**: rows are the ticked selection when there is one, otherwise everything matching the table's current multifilter and `externalFilter`. Columns are the visible, exportable ones, in declared order — so `ColumnVisibilityMenu` doubles as export customization. `largeScreensOnly` columns always export, because a viewport width must not change a file's contents.
- The four column props (`exportHeader`, `exportValue`, `exportStyle`, `exportable`) as rows in the existing column-definition table at line 776, with a worked `exportStyle` example using score-band ARGB colours.
- A note that the button must render inside the same namespace as the tables it names, and that a fully-qualified `-table` id bypasses namespace resolution.

- [ ] **Step 4: Final verification**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, clean build.

- [ ] **Step 5: Stage**

```bash
git add demo/EasyVisionDemoPage.tsx README.md
# suggested message: docs(export): document EasyVisionExportButton and add a demo
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| Source registry, separate from `easyVisionRegistry` | 7 |
| `ExportSource` shape, resolvers run at export time | 1 (types), 8 (wiring) |
| Row resolution: selection else all matching | 6 (predicate), 8 (wiring) |
| Local mode short-circuits to `filteredData` | 8 |
| `fetchAllRows` extracted from `resolveEagerAll` | 5 |
| Five column additions | 3 |
| Column visibility shared with the table | 4 |
| `largeScreensOnly` excluded | 4 (falls out — never enters `columnVisibility`), 10 (verified, documented) |
| Sheet naming, sanitizing, dedupe | 2 |
| Header fill, bold, auto-width | 1 |
| Skip empty sources; no file when all empty | 2 |
| Native download, no `file-saver` | 1 |
| Filename with ISO timestamp | 1 |
| Button props, states, sequential resolution | 9 |
| Error handling: abort whole, `onError`, always return to idle | 9 |
| Vitest, six test areas | 1-7 |
| Demo, README | 10 |
