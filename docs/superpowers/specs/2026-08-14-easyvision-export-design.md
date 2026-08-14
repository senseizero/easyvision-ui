# EasyVision export-to-Excel — design

Date: 2026-08-14
Status: approved, pending implementation plan
Scope: `easyvision-ui` only. No consumer migrations in this effort.

## Goal

A built-in export button in `easyvision-ui` that writes the contents of one or
more filter-linked tables to a single `.xlsx` file, one worksheet per table.

The button names the tables it exports. Each table supplies its own columns and
its own row-fetching, so a call site adds an export by naming ids — not by
re-declaring columns or re-implementing pagination.

## Why

`nml-vision` implements this today in `src/utils/utils.ts` as four near-identical
ExcelJS functions (~450 lines, roughly 80% shared boilerplate):

| Function | Sheets | Distinguishing feature |
|---|---|---|
| `exportXLSX` | 1 | 22 hardcoded headers; reaches into `row.alert` for fields absent from `RowData` |
| `exportEvaluationResultsXLSX` | 1 | conditional fills on score / impact / probability |
| `exportSearchBatchResultsXLSX` | N | groups rows by client into one sheet each; sheet-name sanitizing + dedupe |
| `exportRiskEvaluationsXLSX` | 1 | conditional fills on score |

Each repeats the same sequence: header row (grey fill, bold) → data rows →
column auto-width → `workbook.xlsx.writeBuffer()` → `Blob` → `saveAs`.

Call sites source their rows three incompatible ways: from an in-memory context
(`alertsRows`, populated via `onDataLoaded`), from a hand-rolled pagination loop
(`SearchDetails.tsx:535-548`), or from raw props. The hand-rolled loop
duplicates — less carefully — what `EasyVisionTable.resolveEagerAll` already
does.

Every one of those concerns belongs to the table, which already knows its
columns, its fetcher, its active filter, its sort, and its selection.

## Decisions

Settled before design; recorded here so the plan doesn't relitigate them.

1. **Discovery by registry.** Tables self-register an export source; the button
   names table ids. Rejected: passing explicit sheet descriptors (re-declares
   what the table knows), and a per-table `export` prop (leaves the multi-sheet
   case — the actual requirement — manual).
2. **Rows = selection if any, else everything matching the filter.**
3. **`exceljs` as a regular dependency**, plain static import. Rejected: lazy
   import behind an optional peer (build complexity), and a dependency-free CSV
   emitter (loses the header and conditional cell styling `nml-vision` relies on).
4. **Exported columns follow table column visibility**, so `ColumnVisibilityMenu`
   doubles as the export-customization UI and users can produce simplified
   exports with no new controls.
5. **No `sheets={[...]}` escape hatch** for non-table data in v1. `buildWorkbook`
   is exported, so it can be added later without rework.

## Architecture

```
easyvision-ui/
  export/
    sources.ts                  # module-level Map<fullId, ExportSource>
    buildWorkbook.ts            # sources → ExcelJS workbook → download. No React.
    EasyVisionExportButton.tsx
  table/
    fetchAllRows.ts             # extracted from resolveEagerAll; shared
    columnVisibility.ts         # extracted visibility merge; shared
  types/
    export.types.ts
```

### Source registry

Export sources live in a module-level `Map` in `export/sources.ts`, **not** in
`easyVisionRegistry`. The registry holds serializable slice state that `patch`,
`drop`, and persistence operate on; export sources are closures over fetchers
and cannot round-trip. Keeping them separate avoids teaching the registry about
values it can't serialize.

The map is keyed by the same `fullId` the registry uses, and the button resolves
ids through `useParentFullId()` + `childFullIdOf(parent, localId, 'table')`. So
`tables={['alerts']}` addresses a table exactly the way every other id in the
library does, nesting included. A fully-qualified id (one already ending in
`-table`) is accepted verbatim as an escape hatch.

```ts
// types/export.types.ts
export interface ExportSource<T = unknown> {
  /** Worksheet name before sanitizing. Defaults to the table's local id.
   *  The button's `sheetNames` map, when it has an entry for this id, wins. */
  sheetName: string;
  /** Resolved at export time: visible, exportable columns, in the order they
   *  are declared in the table's `columns` prop. */
  getColumns: () => EasyVisionColumn<T>[];
  /** Resolved at export time: selection-aware row set. */
  getRows: () => Promise<T[]>;
}

export function registerExportSource(fullId: string, source: ExportSource): void;
export function unregisterExportSource(fullId: string): void;
export function getExportSource(fullId: string): ExportSource | undefined;
```

`EasyVisionTable` registers on mount and unregisters on unmount. `getColumns`
and `getRows` read through refs and read the live slice from
`easyVisionRegistry.getState()`, so neither prop identity churn nor a column
toggle requires re-registration.

### Row resolution

`getRows` **always materializes the full matching set, then applies the
selection predicate**:

| Selection state | Rows exported |
|---|---|
| none | every row matching the merged multifilter + `externalFilter` |
| `scope: 'page'` with ids | those ids — correct even when the selection spans pages never loaded |
| `scope: 'all'` with `exceptIds` | everything matching, minus the unticked ids |

One code path instead of four. Special-casing "the rows are already in
`apiRows`" would be wrong for persisted selections spanning unloaded pages, and
it is precisely the bug shape `SearchDetails.tsx` works around by hand.

In local pagination mode there is nothing to fetch: `getRows` reads the
already-computed `filteredData` and applies the same predicate.

The API pagination loop moves out of `EasyVisionTable.resolveEagerAll` into
`table/fetchAllRows.ts`, and both call it. Extracting rather than copying keeps
the filter merge (`externalFilter.where` under `multifilter.query.where`, the
multifilter winning on key collisions) and the page-size / early-exit logic in
one place.

```ts
// ponytail: exports of a small selection still page through the whole result
// set. Add an optional `fetchByIds` to ExportSource if that gets slow.
```

### Columns

Five optional additions to `EasyVisionColumn`, on both the `data` and `ui`
variants:

```ts
/** Header text in the sheet. Default: `header` when it is a string, else `field`. */
exportHeader?: string;
/** Cell value. Default: `getByPath(item, field)`; arrays joined with ", ". */
exportValue?: (item: T) => string | number | boolean | Date | null;
/** Per-cell styling hook. Return ARGB strings (e.g. 'FFDC2626'). */
exportStyle?: (value: unknown, item: T) => {
  fill?: string;
  fontColor?: string;
  bold?: boolean;
};
/** Default: true for `data` columns, false for `ui` columns. */
exportable?: boolean;
```

`exportValue` is what lets a consumer collapse a hand-written row mapper into
the column definitions it already maintains. `exportStyle` covers all three of
`nml-vision`'s colour schemes (score bands, impact, probability) with one hook,
while the domain-specific thresholds stay in the consuming app.

A `ui` column becomes exportable by setting `exportable: true` alongside an
`exportValue`.

### Column visibility

Exported columns are those where `exportable !== false` **and** the column is
visible in the table's current state.

Visibility must be the *same* computation the table renders with, not a
re-derivation. The merge at `EasyVisionTable.tsx:359-369` —
`{ ...initiallyHidden defaults, ...slice.columnVisibility }`, where a column is
visible unless explicitly `false` — moves into `table/columnVisibility.ts` and
both the table and the export source call it. This preserves the existing
guarantee that a column added after a `persist`ed slice was written still
honours its declared default.

**`largeScreensOnly` is deliberately excluded.** It is CSS-only
(`ev-table-large-only`, `EasyVisionTable.tsx:833`) and never enters
`columnVisibility`. Were it to affect the export, the same click would produce
different files on a laptop and a wide monitor. It falls out correctly for free;
it is stated here so it is not later "fixed" into the visibility path.

### Workbook construction

`export/buildWorkbook.ts` is pure and React-free: sources in, file out.

- One worksheet per source, in the order the button lists them.
- Sheet names sanitized by the rule ported from `nml-vision`: replace
  `* ? : \ / [ ]` with `-`, truncate to 31 characters. Duplicates after
  sanitizing get a numeric suffix that keeps the name within 31 characters.
- Header row: solid fill `FFCCCCCC`, bold — matching the existing exports.
- Column widths: `max(10, longest rendered cell length + 2)`.
- Cell styling applied from `exportStyle` where present.
- A source contributing no rows, or no visible exportable columns, is skipped
  entirely rather than emitting an empty sheet.
- If every source is skipped, no file is produced and `onEmpty` fires.

Download uses `URL.createObjectURL` + a synthesized `<a download>` +
`revokeObjectURL`. `file-saver` is not needed and is not added.

Filename: `${filename}_${new Date().toISOString()}.xlsx`, matching the
convention already in use.

### The button

```tsx
<EasyVisionExportButton
  tables={['alerts', 'evaluations']}
  filename="informe"
  labels={{ export: 'Exportar', exporting: 'Exportando…' }}
  onError={(error) => ...}
  onEmpty={() => ...}
/>
```

Props:

| Prop | Type | Notes |
|---|---|---|
| `tables` | `string[]` | Local ids (namespace-resolved) or fully-qualified `-table` ids. Order determines sheet order. |
| `filename` | `string` | Timestamp and extension appended. |
| `sheetNames` | `Record<string, string>` | Optional per-table override of the default sheet name. |
| `labels` | `Partial<ExportLabels>` | `export`, `exporting`. Follows the library's i18n convention. |
| `onError` | `(e: unknown) => void` | Fetch or workbook failure. |
| `onEmpty` | `() => void` | Nothing to export; no file written. |
| `disabled` | `boolean` | |
| `className` | `string` | |

States: idle → exporting (spinner, disabled) → idle. The button is disabled when
none of the named ids resolve to a registered source.

It renders anywhere inside the namespace, including the table's `toolbarRight`
slot.

## Data flow

```
click
  └─ for each id in `tables`
       ├─ resolve fullId (namespace) → ExportSource
       ├─ sheet name  = sheetNames[id] ?? source.sheetName
       ├─ getColumns()  → visible ∩ exportable, in declared order
       └─ getRows()     → fetchAllRows(merged filter, sort) → selection predicate
  └─ buildWorkbook(sheets)
       ├─ sanitize + dedupe sheet names
       ├─ header row (fill FFCCCCCC, bold)
       ├─ data rows via exportValue, styled via exportStyle
       └─ auto-width
  └─ writeBuffer → Blob → object URL → <a download> → revoke
```

Sheets are resolved sequentially, not in parallel: each source may page through
a large result set, and firing several such loops at once against the same API
is a good way to get rate-limited.

## Error handling

- A failure fetching any single source aborts the whole export and fires
  `onError`. A partial workbook silently missing a sheet is worse than no file.
- The button always returns to idle in a `finally`.
- Errors are surfaced through `onError`, never through `alert` or a thrown
  rejection — the library does not own the consumer's notification UI.

## Testing

`easyvision-ui` has no test runner today. `vitest` is added as a devDependency
(vite is already present, so this is a one-line addition) with a single spec
covering `buildWorkbook` and the source-resolution helpers — the logic where a
silent break produces a plausible-looking but wrong file:

- multiple sources → multiple sheets, in the order given
- sheet-name sanitizing, 31-char truncation, and duplicate suffixing
- `exportHeader` / `exportValue` defaults, including array joining and nested
  `field` dot-paths
- hidden columns excluded; `largeScreensOnly` columns retained
- selection predicate across all three selection states
- empty source skipped; all-empty produces no file

`buildWorkbook` takes an injectable download function so the spec asserts on the
generated workbook without a DOM.

The demo page gains a two-table export example for visual confirmation.

## Deliverables

1. `types/export.types.ts` — `ExportSource`, `ExportLabels`, button props.
2. `export/sources.ts` — register / unregister / get.
3. `export/buildWorkbook.ts` — sheet assembly, styling, download.
4. `export/EasyVisionExportButton.tsx`.
5. `table/fetchAllRows.ts` — extracted from `resolveEagerAll`, called by both.
6. `table/columnVisibility.ts` — extracted visibility merge, called by both.
7. `types/table.types.ts` — the five column additions.
8. `table/EasyVisionTable.tsx` — register/unregister its source; call the two
   extracted helpers.
9. `index.ts` — export the button, `buildWorkbook`, and the new types.
10. `package.json` — add `exceljs`; add `vitest` as a devDependency.
11. `README.md` — an `EasyVisionExportButton` section plus column-prop rows.
12. `demo/` — a two-table export example.

## Out of scope

- Migrating `nml-vision`. The four exporters in `utils.ts` and their call sites
  stay as they are until a later effort.
- Non-table sheets (metrics headers, computed rollups).
- Formats other than `.xlsx`.
- Server-side generation.
