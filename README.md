# EasyVision

A small, shadcn-backed component set for building filtered, paginated, sortable views with as little plumbing as possible. Each component owns its own state via an internal zustand registry — the user only supplies an `id`.

```tsx
import {
  EasyVisionInput,
  EasyVisionSelector,
  EasyVisionMultifilter,
  EasyVisionTable,
} from '@/components/easyvision';
```

---

## Table of contents

- [Core concepts](#core-concepts)
  - [The `id` rule](#the-id-rule)
  - [Persistence and cleanup](#persistence-and-cleanup)
  - [`clearWhen`](#clearwhen)
  - [Labels (i18n)](#labels-i18n)
- [`EasyVisionCard`](#easyvisioncard)
- [`EasyVisionAccordion`](#easyvisionaccordion)
- [`EasyVisionInput`](#easyvisioninput)
- [`EasyVisionSelector`](#easyvisionselector)
- [`EasyVisionMultifilter`](#easyvisionmultifilter)
  - [Field types](#field-types)
  - [Pinned, chip, locked](#pinned-chip-locked)
  - [Perform: live vs manual](#perform-live-vs-manual)
  - [Standalone usage (no table)](#standalone-usage-no-table)
  - [Nesting](#nesting)
  - [Snapshot shape](#snapshot-shape)
- [`EasyVisionTable`](#easyvisiontable)
  - [Choosing a data + filter strategy](#choosing-a-data--filter-strategy)
  - [Local vs API mode](#local-vs-api-mode)
  - [Column definitions](#column-definitions)
    - [Column sizing, truncation, and resizing](#column-sizing-truncation-and-resizing)
    - [Body height & sticky header](#body-height--sticky-header)
    - [Pagination footer modes](#pagination-footer-modes)
  - [Selection](#selection)
  - [Highlighting rows (master/detail)](#highlighting-rows-masterdetail)
  - [Binding a multifilter](#binding-a-multifilter)
  - [External filter and manual refetch](#external-filter-and-manual-refetch)
  - [Toolbar slots](#toolbar-slots)
- [`EasyVisionExportButton`](#easyvisionexportbutton)
  - [What gets exported](#what-gets-exported)
  - [Resolving table ids](#resolving-table-ids)
- [Migration cookbook](#migration-cookbook)
- [Integration recipes](#integration-recipes)
  - [API adapters: LoopBack](#api-adapters-loopback)
  - [Local mode filtering with the same DSL — `matchLoopbackWhere`](#local-mode-filtering-with-the-same-dsl--matchloopbackwhere)
- [Gotchas](#gotchas)
- [Escape hatch: direct registry access](#escape-hatch-direct-registry-access)

---

## Core concepts

### The `id` rule

Every stateful component takes a required `id: string`. Internally that becomes a key in the registry: `${id}-${componentKind}`, e.g. `myFilter-multifilter`, `userTable-table`.

When a component is declared inside another (a Selector field inside a Multifilter, a Multifilter bound to a Table), only the **outer** id is needed — children inherit the namespace and append their own local id. Example:

```tsx
<EasyVisionTable
  id="riskEvals"                                 // riskEvals-table
  multifilter={{
    id: 'mainFilter',                            // riskEvals-table.mainFilter-multifilter
    config: { fields: [
      { id: 'level', type: 'selector', /*...*/ } // riskEvals-table.mainFilter-multifilter.level value
    ]},
  }}
/>
```

Pick `id`s that are stable across renders. They don't have to be globally unique — the namespace tree disambiguates them.

### Persistence and cleanup

Every component is **non-persistent by default**: when it unmounts, its slice (and every descendant slice) is dropped from the registry. To keep state across mount/unmount cycles, set `persist={true}`.

```tsx
<EasyVisionMultifilter id="alerts" persist config={...} />
```

Because the registry is a single zustand-vanilla store, you can inspect state at any time:

```tsx
import { easyVisionRegistry } from '@/components/easyvision';

console.log(easyVisionRegistry.getState().slices);
```

### `clearWhen`

Pass a predicate that receives the current snapshot/value. When it returns `true`, the slice is dropped and re-initialized from defaults. Useful for "reset filters when the parent entity changes":

```tsx
<EasyVisionInput
  id="search"
  clearWhen={(value) => parentId !== lastParentIdRef.current}
/>
```

### Labels (i18n)

Components ship with Spanish defaults (`Buscar`, `Resultados por página`, etc.). All user-visible strings can be overridden via the `labels` prop, which takes a `Partial<Labels>`:

```tsx
<EasyVisionTable
  labels={{ rowsPerPage: t('table.rows'), of: t('common.of') }}
  /* ... */
/>
```

To plug into a `react-i18next` (or any other) translation system, just pass `t(...)` calls in the `labels` object.

---

## `EasyVisionCard`

Self-contained card primitive shared by every EasyVision surface (the
Multifilter container is one). Mirrors the Shadcn Card API but lives inside
the library, so projects consuming EasyVision don't need to install or
maintain a separate `ui/card` component. Visuals rely only on the standard
Tailwind theme tokens (`bg-card`, `text-card-foreground`, `border`,
`shadow-sm`) the host project already exposes.

It's a **purely presentational, stateless** component — no `id`, no slice,
no persistence. Use it anywhere you'd otherwise hand-roll
`<div className="bg-card border border-border rounded-md shadow-sm">`.

### Sub-components

All sub-components are **independent and optional**. Compose only what you
need; nothing enforces ordering or presence.

| Component | Element | Default classes | Purpose |
|---|---|---|---|
| `EasyVisionCard` | `div` | `rounded-md border bg-card text-card-foreground shadow-sm` | Outer container. |
| `EasyVisionCardHeader` | `div` | `flex flex-col space-y-1.5 p-6` | Vertical stack for title + description. |
| `EasyVisionCardTitle` | `h3` | `text-2xl font-semibold leading-none tracking-tight` | Heading inside the header. |
| `EasyVisionCardDescription` | `p` | `text-sm text-muted-foreground` | Subtitle under the title. |
| `EasyVisionCardContent` | `div` | `p-6 pt-0` | Main body. |
| `EasyVisionCardFooter` | `div` | `flex items-center p-6 pt-0` | Action row at the bottom. |

### Minimal usage

Just the container — what the Multifilter does internally:

```tsx
<EasyVisionCard className="p-3">
  {/* anything */}
</EasyVisionCard>
```

### Full composition

```tsx
import {
  EasyVisionCard,
  EasyVisionCardHeader,
  EasyVisionCardTitle,
  EasyVisionCardDescription,
  EasyVisionCardContent,
  EasyVisionCardFooter,
} from '@/components/easyvision';

<EasyVisionCard>
  <EasyVisionCardHeader>
    <EasyVisionCardTitle>Risk evaluations</EasyVisionCardTitle>
    <EasyVisionCardDescription>Last 30 days</EasyVisionCardDescription>
  </EasyVisionCardHeader>
  <EasyVisionCardContent>
    <EasyVisionTable id="riskEvals" /* ... */ />
  </EasyVisionCardContent>
  <EasyVisionCardFooter>
    <Button>Export</Button>
  </EasyVisionCardFooter>
</EasyVisionCard>
```

### Notes

- All components forward `ref` and accept any standard HTML attributes.
- `className` is **merged** with the defaults, not replaced — pass
  `className="p-3"` to override padding without losing the border/shadow.
- Skip the header entirely if you don't need a title; the body padding
  comes from `EasyVisionCardContent` (`p-6 pt-0`) — when there's no header,
  use `<EasyVisionCardContent className="pt-6">` or just put your content
  in a plain wrapper.

---

## `EasyVisionAccordion`

A list of **unfoldable questions** (FAQ-style). Holds an indefinite number of
items and accepts **free-format content** — both the `question` header and the
body are `ReactNode`, so an answer can be plain text or arbitrary JSX (tables,
tabs, lists, charts…).

Like `EasyVisionCard`, it's self-contained and **does not** use the `id`/slice
machinery — open/closed is ephemeral UI state held locally (optionally
controlled). Visuals rely only on the standard Tailwind theme tokens
(`muted`, `card`, `border`, `foreground`) via `.ev-accordion*` classes.

### Minimal usage (data-driven)

```tsx
import { EasyVisionAccordion } from '@easyvision/easyvision-ui';

<EasyVisionAccordion
  items={[
    { id: 'what', question: '¿Qué es NML Vision?', content: <p>…</p> },
    { id: 'scoring', question: '¿Cómo funciona el scoring?', content: <ScoringTable /> },
  ]}
/>
```

The `items` array can be any length and built dynamically (filter/spread for
conditional questions) — the FAQ list is not fixed at compile time.

### Compound usage

Equivalent, when you'd rather write the bodies inline as children:

```tsx
import { EasyVisionAccordion, EasyVisionAccordionItem } from '@easyvision/easyvision-ui';

<EasyVisionAccordion mode="multiple">
  <EasyVisionAccordionItem id="what" question="¿Qué es NML Vision?">
    <p>…</p>
  </EasyVisionAccordionItem>
  <EasyVisionAccordionItem id="scoring" question="¿Cómo funciona el scoring?">
    <ScoringTable />
  </EasyVisionAccordionItem>
</EasyVisionAccordion>
```

> Mix-and-match is not supported in a single instance: pass **either** `items`
> **or** `EasyVisionAccordionItem` children. If `items` is provided, children
> are ignored.

### Open behaviour

- `mode="single"` (default) — one item open at a time, like the NML Vision Help
  page. `mode="multiple"` — items open independently.
- Uncontrolled: set `defaultOpenIds={['scoring']}` or per-item `defaultOpen`.
- Controlled: pass `openIds` + `onOpenChange` to own the state. Use
  `onOpenChange` to lazily fetch a question's data the first time it opens (the
  callback receives the next list of open ids).

### Props

#### `EasyVisionAccordion`

| prop | type | default | notes |
|---|---|---|---|
| `items` | `AccordionItem[]` | — | Data-driven items. Omit when using children. |
| `children` | `ReactNode` | — | `EasyVisionAccordionItem` elements (alternative to `items`). |
| `mode` | `'single' \| 'multiple'` | `'single'` | Open behaviour. |
| `openIds` | `string[]` | — | Controlled set of open ids. |
| `defaultOpenIds` | `string[]` | — | Uncontrolled initial open ids. |
| `onOpenChange` | `(openIds: string[]) => void` | — | Fired on every open/close. |
| `className` | `string` | — | Merged with `ev-accordion`. |

`AccordionItem` / `EasyVisionAccordionItem` fields: `id` (required, stable key),
`question` (`ReactNode`), `content` / children (`ReactNode` body), optional
`defaultOpen` and `disabled`.

### Notes

- Each item renders an accessible trigger (`<button>` with `aria-expanded` /
  `aria-controls`) and a `role="region"` panel.
- The chevron rotates on open; collapsed panels are unmounted (not hidden), so
  heavy bodies don't render until first opened.

---

## `EasyVisionInput`

A debounced text input that persists its value by `id`.

### Minimal usage

```tsx
<EasyVisionInput
  id="searchClients"
  placeholder="Buscar..."
  icon="search"
  onChange={(value) => console.log(value)}
/>
```

### Props

| prop | type | default | notes |
|---|---|---|---|
| `id` | `string` | — | Required. Slice key. |
| `label` | `string` | — | Renders above the input. |
| `placeholder` | `string` | — | |
| `debounceMs` | `number` | `300` | Time of inactivity before `onChange` fires. |
| `mandatory` | `boolean` | `false` | Adds red asterisk; reports invalid to a parent multifilter for Buscar gating. |
| `defaultValue` | `string` | `''` | Used on first mount only. |
| `onChange` | `(value: string) => void` | — | Fires with the **debounced** value. |
| `icon` | `'search' \| 'none'` | `'none'` | |
| `showClearButton` | `boolean` | `false` | Adds an inline X. |
| `disabled` | `boolean` | `false` | |
| `className` | `string` | — | |
| `persist` | `boolean` | `false` | Keep state across unmount. |
| `clearWhen` | `(value) => boolean` | — | Reset the slice when this returns `true`. |
| `onStateChange` | `(value) => void` | — | Fires on every change (no debounce). |

---

## `EasyVisionSelector`

Single-select dropdown. Supports `searchable` (cmdk-backed combobox) and `confirmMode` (commit on button press).

### Minimal usage

```tsx
<EasyVisionSelector
  id="country"
  label="País"
  options={[
    { value: 'ES', label: 'España' },
    { value: 'FR', label: 'Francia' },
  ]}
  onChange={(v) => console.log(v)}
/>
```

### Async options

```tsx
<EasyVisionSelector
  id="sector"
  options={async () => fetch('/api/sectors').then(r => r.json())}
/>
```

### Searchable + mandatory

```tsx
<EasyVisionSelector
  id="risk"
  searchable
  mandatory
  options={riskOptions}
/>
```

### Props

| prop | type | default | notes |
|---|---|---|---|
| `id` | `string` | — | Required. |
| `label` | `string` | — | |
| `options` | `Array<{value, label}>` or `() => Promise<Array<...>>` | — | Sync or async. |
| `placeholder` | `string` | `'Seleccionar...'` | |
| `mandatory` | `boolean` | `false` | Forces a value; affects parent multifilter Buscar gating. |
| `defaultValue` | `string \| number` | — | |
| `confirmMode` | `boolean` | `false` | Renders a Confirm button; value isn't committed until pressed. |
| `confirmLabel` | `string` | `'Confirmar'` | Label for the confirm button. |
| `searchable` | `boolean` | `false` | Switches to a Combobox with text search. |
| `onChange` | `(value) => void` | — | Fires with the committed value. |
| `disabled`, `className`, `persist`, `clearWhen`, `onStateChange` | as in Input | | |

---

## `EasyVisionMultifilter`

A composable filter row: pinned (always-visible) area + dynamic chips area + optional Buscar button. Supports nested multifilters.

### Minimal usage

```tsx
<EasyVisionMultifilter
  id="alertsFilter"
  performButton
  onPerform={(snap) => fetchAlerts(snap.query)}
  config={{
    fields: [
      { id: 'q',      type: 'text',        field: 'name', label: 'Búsqueda', prominent: true, pinned: true },
      { id: 'level',  type: 'multiselect', field: 'level',  label: 'Nivel',  pinned: true, mandatory: true,
        options: [{value:'CRITICAL', label:'Crítico'}, {value:'HIGH', label:'Alto'}] },
      { id: 'status', type: 'selector',    field: 'status', label: 'Estado', pinned: true,
        options: [{value:'pending', label:'Pendiente'}, {value:'completed', label:'Completado'}] },
      { id: 'dates',  type: 'dateRange',   field: 'created', label: 'Fechas' },
    ],
  }}
/>
```

### Prominent fields (the top search bar)

Any `type: 'text'` field with `prominent: true` renders **full-width at the top of the panel** with a magnifying-glass icon, instead of as an inline chip. Pressing **Enter** inside a prominent field triggers the Buscar action. The flag is orthogonal to `pinned`/`initiallyActive`, so any combination works:

| `prominent` | `pinned` | `initiallyActive` | behaviour |
|---|---|---|---|
| `true` | `true`  | — | Permanent big bar (most common — replaces the legacy `searchField`). |
| `true` | `false` | `true`  | Big bar that the user can detach with the X and re-add from the `+` menu. |
| `true` | `false` | `false` | Hidden by default. Appears as a big bar once added from the `+` menu. |
| `false` | any | any | Renders as an inline chip (default). |

Multiple prominent fields are allowed and wrap onto extra rows as needed.

> **Legacy:** `config.searchField` is kept as a deprecated alias and behaves like a virtual prominent + pinned text field. Prefer `prominent: true, pinned: true` in `fields` for new code so there's a single mental model — *everything is a field*.

### Field types

Each entry in `config.fields` is one of:

| `type` | renders | value shape |
|---|---|---|
| `'text'` | inline text input chip | `string` |
| `'selector'` | inline dropdown chip | `string \| number` |
| `'multiselect'` | tag-pill chip with popover checkboxes | `(string \| number)[]` |
| `'dateRange'` | date-range popover chip | `{ from?: Date; to?: Date }` |
| `'numberRange'` | min/max pair chip | `{ min?: number; max?: number }` |
| `'multifilter'` | nested filter box (see [Nesting](#nesting)) | `{ values: ..., activeFields: ... }` |
| `'custom'` | your own component (`definition.component`) | whatever you store |

Common base fields on every field def:

```ts
{
  id: string;          // local id
  label: string;       // shown next to the chip
  field?: string;      // API path used to build the where clause; e.g. 'client.country'
  pinned?: boolean;    // always rendered (locked-in)
  initiallyActive?: boolean;  // for non-pinned fields, show by default on first mount
  locked?: boolean;    // suppress X chip but keep the field active
  mandatory?: boolean; // gates Buscar
  visible?: boolean | ((values) => boolean);   // conditional visibility
  defaultValue?: unknown;
  placeholder?: string;
  toCondition?: (value) => unknown;  // override the where-clause builder for this field
}
```

### Multiselect options: static, async, and live search

A `'multiselect'` field draws its choices from `options` — either a static array or an async
loader run **once on mount**:

```tsx
// static
{ id: 'level', type: 'multiselect', field: 'level', label: 'Nivel',
  options: [{ value: 'CRITICAL', label: 'Crítico' }, { value: 'HIGH', label: 'Alto' }] }

// async — fetched once when the field mounts
{ id: 'sector', type: 'multiselect', field: 'sectorId', label: 'Sector',
  options: async () => (await api.getSectors()).map(s => ({ value: s.id, label: s.name })) }
```

For option sets too large to load up front — or that only exist behind a search API — a
`'multiselect'` field can instead (or also) provide **`searchOptions`**: a per-keystroke async
search wired to the popover's search box.

```tsx
{
  id: 'sector',
  type: 'multiselect',
  field: 'sectorId',
  label: 'Sector / CNAE',
  // Called on every keystroke (debounced 300ms, matching EasyVisionInput).
  // The popover lists whatever this resolves to.
  searchOptions: async (term) => {
    const rows = await api.searchSectors(term);
    return rows.map((s) => ({ value: s.id, label: `${s.cnae} — ${s.name}` }));
  },
}
```

| | `options` | `searchOptions` |
|---|---|---|
| When it runs | once on mount | on every keystroke (debounced 300ms) |
| Popover search box | filters the loaded list in memory | drives the query; results come from your fn |
| Good for | small / bounded option sets | large sets, or options that live behind an API |

Notes:
- `options` is **optional** when `searchOptions` is set. You may supply both: `searchOptions`
  powers the search box, while `options` (when present) still resolves labels for
  already-selected values.
- With `searchOptions` only, the widget caches the labels of options the user picks for the
  session, so the selected badges stay readable after the search box is cleared. A value
  persisted from a previous session but never re-searched falls back to showing its raw value
  until it appears in a search result again.
- Stale in-flight responses are discarded — only the latest query's results are shown.

### Pinned, chip, locked

- **`pinned: true`** — always rendered in the pinned row, never has an X chip, never appears in the "+" popover.
- **`locked: true`** (and not pinned) — appears in the chip area but cannot be removed.
- **default** (neither flag) — appears under the "+" popover until added; once added, gets an X chip to remove.

To make the multifilter fully static (no `+`, no X), set `editable={false}` on the multifilter itself:

```tsx
<EasyVisionMultifilter editable={false} config={...} />
```

### Perform: live vs manual

> **Terminology.** "Perform" is the generic name for "user committed the filter" — i.e. the **Buscar / Search** action. It's called `perform` (not `onSearch`) because the multifilter is generic: the same event can drive a list refetch, an export, a recalculation, a navigation.

Perform fires through one of four paths:

1. The user clicks the **Buscar** button (when `performButton: true`).
2. The user presses Enter in a prominent text field (when `performButton: true`).
3. `performOnMount` triggers it once after the multifilter mounts, if there's any non-empty value to re-emit (used to restore persisted state on remount).
4. The imperative ref handle: `ref.current.perform()`.

In addition, **live mode** auto-fires perform on every change to the active values / fields. Use it for in-memory tables where filtering is cheap and per-change UI updates feel natural. Manual mode stays explicit — typically what you want for API-backed tables, where every perform = a network request.

```tsx
<EasyVisionMultifilter
  id="alerts"
  performMode="live"          // 'live' | 'manual' | 'auto' (default 'auto')
  performDebounceMs={150}     // debounce window for live mode; default 0
  performOnMount              // still useful for restoring persisted state
  onPerform={(snap) => api.list(snap.query)}
  config={...}
/>
```

`performMode: 'auto'` (the default) means **"ask the parent"**. When the multifilter is mounted inside an [`EasyVisionTable`](#binding-a-multifilter) via that table's `multifilter` prop, the table picks `'live'` for `paginationMode: 'local'` and `'manual'` for `paginationMode: 'api'`. Standalone, `'auto'` resolves to `'manual'` — safer for unknown consumers and matches the historical default.

The two modes compose with the rest of the perform machinery:

| | Manual | Live |
|---|---|---|
| Buscar button (`performButton: true`) | Visible if dirty + valid; press commits. | Visible if dirty + valid; press just forces an immediate perform (debounce skipped). |
| `performOnMount` | Fires once on mount when values are present. | Same. |
| Imperative `ref.current.perform()` | Always available. | Always available; flushes the debounce timer. |
| Field add/remove (`+` / `X`) | Stages; no perform until Buscar / ref / unmount. | Counts as a change; debounced perform follows. |
| Per-keystroke `onChange` | Always fires; perform doesn't follow. | Always fires; perform follows after `performDebounceMs`. |

#### Buscar button

Set `performButton={true}` to render the button. Its enable state combines:

- `editable !== false` — the multifilter must be active.
- `isValid` — every `mandatory` field has a non-empty value (recursively, including nested multifilters).
- `isDirty` — the snapshot differs from the last confirmation (or, if never confirmed, has at least one non-empty value).

After press, dirty resets to `false`; editing back to the confirmed state re-disables the button.

```tsx
<EasyVisionMultifilter
  id="alerts"
  performButton
  performLabel="Buscar"          // default; localize as needed
  performPosition="inline"       // 'inline' | 'belowRow' | 'externalRef'
  performOnMount                 // fire once if persisted state has values
  onPerform={(snap) => api.list(snap.query)}
  config={...}
/>
```

You can also call perform programmatically via a ref:

```tsx
const ref = useRef<MultifilterHandle>(null);
// ...
<EasyVisionMultifilter ref={ref} {...} />
// ref.current?.perform();
// ref.current?.getSnapshot();
```

> **Note on `onPerform` timing.** `onPerform` is dispatched on a microtask after the internal snapshot commit, so it's safe to call `setState` on a parent component inside the callback. The microtask deferral prevents React's "Cannot update a component while rendering a different component" warning that would otherwise fire when perform happens inside a commit phase (e.g. via `performOnMount` or live-mode auto-fire).

### Standalone usage (no table)

Nothing about the multifilter is table-specific — it's a generic, persisted, validated form-snapshot component. Use it on its own to drive a chart, a KPI panel, an export, a URL query, or any other consumer.

Declarative — `onPerform` runs your action when the user clicks Buscar (and once on mount when `performOnMount` is set):

```tsx
const [kpis, setKpis] = useState<Kpis | null>(null);

<EasyVisionMultifilter
  id="kpisFilters"
  persist
  config={filterConfig}
  performButton
  performOnMount
  onPerform={(snap) =>
    fetchKpisByFilter({ where: snap.query.where ?? {} }).then(setKpis)
  }
/>
<KpiPanel data={kpis} />
```

Imperative — drive the multifilter from outside via the ref handle. Useful for parent buttons, route changes, or wizard flows:

```tsx
const mfRef = useRef<MultifilterHandle>(null);

<EasyVisionMultifilter ref={mfRef} id="..." config={...} />

// Read the current snapshot (e.g. to mirror into the URL):
const snap = mfRef.current?.getSnapshot();

// Force a perform from outside (e.g. a global "Apply" button):
mfRef.current?.perform();
```

The handle exposes `{ perform, getSnapshot }`. The same `MultifilterSnapshot` shape applies whether the multifilter is bound to a table or standing alone — see [Snapshot shape](#snapshot-shape).

### Nesting

Declare a child multifilter as a field of type `'multifilter'`:

```tsx
{
  id: 'clientFilter',
  type: 'multifilter',
  label: 'Cliente avanzado',
  pinned: false,
  config: {
    fields: [
      { id: 'sector',  type: 'selector', field: 'client.sector',  label: 'Sector',  options: sectorOptions },
      { id: 'country', type: 'selector', field: 'client.country', label: 'País',    options: countryOptions },
    ],
  },
}
```

The child's slice id is derived (`parent.fullId.${childId}-multifilter`). The parent's snapshot includes the child's values under the field id, and the child's mandatory/dirty states bubble up. The root owns the Buscar button by default; setting `performButton: true` on a nested config gives that section its own Apply button which only confirms its own snapshot (the table-level Buscar still belongs to the root).

### Snapshot shape

Every `onChange` and `onPerform` receives:

```ts
interface MultifilterSnapshot {
  values: Record<string, unknown>;     // includes nested multifilter values as nested objects
  activeFields: string[];              // visible field ids in display order
  isValid: boolean;                    // every mandatory has non-empty value
  isDirty: boolean;                    // differs from last confirmation
  query: {
    where?: Record<string, unknown>;   // built API filter clause
    order?: string[];
    limit?: number;
  };
}
```

The default `query.where` builder uses these conventions per type:
- `text` → `{ [field]: { $regex: `.*${value}.*`, $options: 'i' } }`
- `selector` → `{ [field]: value }`
- `multiselect` → `{ [field]: { $in: value } }`
- `dateRange` → `{ [field]: { $gte, $lte } }` (ISO strings)
- `numberRange` → `{ [field]: { $gte, $lte } }`

Override per field with `toCondition: (value) => unknown` (return either a primitive — wrapped in `{ [field]: ... }` — or a full clause containing `$or`/`$and`, which is merged at the top level of `where`). Useful for searching multiple paths with one input, or for translating UI values into a backend-specific shape.

```ts
// Search bar that matches client.name OR title OR topics:
{
  id: 'q',
  type: 'text',
  prominent: true,
  pinned: true,
  toCondition: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return undefined;
    const like = { $regex: `.*${s}.*`, $options: 'i' };
    return { $or: [
      { 'client.name': like },
      { title: like },
      { relatedTopicsText: like },
    ]};
  },
}
```

> `transform` is the deprecated old name for `toCondition` and is still accepted as an alias.

### Multifilter props

| prop | type | default | notes |
|---|---|---|---|
| `id` | `string` | — | Required. |
| `config` | `MultifilterConfig` | — | Required. See [Field types](#field-types). |
| `editable` | `boolean` | `true` | When `false`, no `+` button and no X chips. |
| `performButton` | `boolean` | `false` | |
| `performLabel` | `string` | `'Buscar'` | |
| `performIcon` | `ReactNode` | search icon | |
| `performPosition` | `'inline' \| 'belowRow' \| 'externalRef'` | `'inline'` | |
| `performTargetRef` | `RefObject<HTMLElement>` | — | Required if `performPosition === 'externalRef'` (TODO portal). |
| `performOnMount` | `boolean` | `false` | Fire `onPerform` once if seeded state has values. |
| `performMode` | `'live' \| 'manual' \| 'auto'` | `'auto'` | When perform fires automatically. `'auto'` defers to the bound table's `paginationMode` (local → live, api → manual); standalone, resolves to manual. See [Perform: live vs manual](#perform-live-vs-manual). |
| `performDebounceMs` | `number` | `0` | Debounce window before a live-mode perform fires after the last change. |
| `onPerform` | `(snap) => void` | — | Fires when perform commits — from Buscar, `performOnMount`, the imperative `perform()` ref, or (live mode) any value/field change after the debounce. Dispatched on a microtask so calling `setState` inside is safe. |
| `onChange` | `(snap) => void` | — | Every change (per keystroke / option toggle). |
| `onStateChange` | `(snap) => void` | — | Same as `onChange`; provided for API symmetry. |
| `showClearAll` | `boolean` | `editable` | Clears values & active fields. |
| `labels` | `Partial<MultifilterLabels>` | Spanish defaults | |
| `className`, `persist`, `clearWhen` | as in Input/Selector | | |

---

## `EasyVisionTable`

A modular table built on TanStack React Table. Pagination and ordering modes are independent: each can be `'local'` or `'api'`. The TanStack surface is fully encapsulated — page code never imports from `@tanstack/react-table`.

### Choosing a data + filter strategy

Use this decision table to pick props before you start. Every row is a valid combination.

| Your situation | `paginationMode` / `orderingMode` | Pass | Filter UI |
|---|---|---|---|
| Full dataset already in memory, no filtering | `local` / `local` | `data={rows}` | — |
| Full dataset, want a built-in filter row | `local` / `local` | `data={rows}` + `multifilter` | bound multifilter |
| Server-paginated list with EasyVision filter chips | `api` / `api` | `fetchData` + `multifilter` | bound multifilter |
| Server-paginated list with **your own** search panel | `api` / `api` | `fetchData` + `externalFilter` + `refetchSignal` | external (you render it) |
| Hybrid: fetch once then sort/filter locally | `local` / `local` | `data={fetchedOnce}` + `multifilter` | bound multifilter |
| Server-paginated, sort the loaded page locally | `api` / `local` | `fetchData` + `data` (the loaded page) | either |

**Rule of thumb:** prefer the bound `multifilter` whenever its field types fit. Reach for `externalFilter`/`refetchSignal` only when you need a non-standard search UI (multi-step wizard, large form, URL-driven). Both can coexist — the multifilter's `where` overrides the external filter on key collisions.

### Minimal local example

```tsx
import { EasyVisionTable, defaultCell } from '@/components/easyvision';

<EasyVisionTable<User>
  id="users"
  data={users}                          // array of all rows
  getRowId={(u) => u.id}
  columns={[
    { field: 'name',  header: 'Nombre' },                                   // auto-render
    { field: 'email', header: 'Email', cell: (u) => defaultCell(u.email) }, // explicit
  ]}
/>
```

### Minimal API example

```tsx
<EasyVisionTable<Alert>
  id="alerts"
  paginationMode="api"
  orderingMode="api"
  getRowId={(a) => a.id}
  fetchData={async ({ page, itemsPerPage, sort, filter }) => {
    const res = await api.list({
      page, limit: itemsPerPage,
      order: sort ? `${sort.column} ${sort.descending ? 'DESC' : 'ASC'}` : undefined,
      where: filter?.where,
    });
    return { rows: res.rows, totalCount: res.total };
  }}
  columns={[
    { field: 'created',       header: 'Fecha' },
    { field: 'client.name',   header: 'Cliente' },                       // nested → not sortable by default
    { field: 'client.sector', header: 'Sector', sortable: true },        // override per column
  ]}
/>
```

### Local vs API mode

| mode | what you pass | what the table does |
|---|---|---|
| `paginationMode="local"` | full `data` array | slices to current page in-memory |
| `paginationMode="api"` | `fetchData` callback | calls `fetchData({page, itemsPerPage, sort, filter})`; uses `result.totalCount` for the page count |
| `orderingMode="local"` | full `data` array | sorts in-memory by resolving the column's `field` (dot paths supported); applies a numeric-in-string heuristic so `"Plan 12"` sorts before `"Plan 100"` |
| `orderingMode="api"` | — | the table doesn't sort; sends `sort` to `fetchData` and renders whatever rows come back |

Mix them freely — e.g. fetch-once then sort/paginate locally, or paginate via API but sort the loaded page locally.

### Column definitions

A column is a discriminated union: a **`data`** column (default) maps to a value in the row; a **`ui`** column is purely presentational. The `type` field discriminates them.

```ts
// Data column — the default; you may omit `type`.
type DataColumn<T> = {
  type?: 'data';
  /** Dot-path to the value (e.g. "client.name"). Doubles as the column ID. */
  field: string;
  header: string | ReactNode | ((ctx) => ReactNode);
  /** Custom renderer; receives the row item directly. Omit for the default span. */
  cell?: (item: T) => ReactNode;
  /** Override the default sort policy. See "Sorting defaults" below. */
  sortable?: boolean;
  initiallyHidden?: boolean;
  largeScreensOnly?: boolean;
  /** Initial column width. Number = px; string = any CSS length (e.g. '20%', '12rem'). */
  width?: number | string;
  /** Truncate cell content with ellipsis when it overflows the column width. */
  truncate?: boolean;
  /** Allow the user to drag the right edge of the header to resize this column. */
  resizable?: boolean;
  /** Header text in an exported sheet. Defaults to `header` when it's a plain string, else `field`. */
  exportHeader?: string;
  /** Cell value in an exported sheet. Defaults to the value at `field` (arrays joined by ", "). */
  exportValue?: (item: T) => ExportCellValue;
  /** Per-cell styling in an exported sheet. Return `undefined` to leave a cell unstyled. */
  exportStyle?: (value: ExportCellValue, item: T) => ExportCellStyle | undefined;
  /** Include this column in exports. Default: `true` for `data` columns, `false` for `ui` columns. */
  exportable?: boolean;
};

// UI column — no underlying value, never sortable.
type UiColumn<T> = {
  type: 'ui';
  field: string;        // unique id
  header: string | ReactNode | ((ctx) => ReactNode);
  cell: (item: T) => ReactNode;   // required
  initiallyHidden?: boolean;
  largeScreensOnly?: boolean;
  width?: number | string;
  truncate?: boolean;
  resizable?: boolean;
  /** See data-column docs. */
  exportHeader?: string;
  /** See data-column docs. A `ui` column has no underlying value, so this is the only way to give it one. */
  exportValue?: (item: T) => ExportCellValue;
  /** See data-column docs. */
  exportStyle?: (value: ExportCellValue, item: T) => ExportCellStyle | undefined;
  /** `ui` columns default to `false` here — opt in alongside `exportValue` to export a computed column. */
  exportable?: boolean;
};

export type EasyVisionColumn<T> = DataColumn<T> | UiColumn<T>;
```

`exportHeader` / `exportValue` / `exportStyle` / `exportable` only affect [`EasyVisionExportButton`](#easyvisionexportbutton) — they have no effect on what's rendered on screen. A worked `exportStyle` example, colouring a score cell by band:

```ts
{
  field: 'score',
  header: 'Score',
  exportStyle: (value) =>
    typeof value === 'number' && value >= 3.5
      ? { fill: 'FF991B1B', fontColor: 'FFFFFFFF', bold: true }   // dark red, white bold text
      : typeof value === 'number' && value >= 2
        ? { fill: 'FFF59E0B', fontColor: 'FF1F2937' }             // amber
        : undefined,                                              // leave low scores unstyled
}
```

**`field` does double duty on data columns:** it's both the column ID and the dot-path used to resolve the value. Internally the library generates an `accessorFn` that reads `row.client?.name` for `field: 'client.name'`. UI columns don't get an accessor — `field` there is just an ID.

**`cell` receives the row item directly** (no `{ row, getValue }` wrappers). For columns where you only want the resolved value with default styling, omit `cell` and the library renders it in a standard span. To get the same span styling around custom content, wrap with `defaultCell(content)`. `defaultCell` accepts an optional second argument that becomes the cell's native `title` tooltip — useful when `truncate: true` is set and you want the full text to appear on hover:

```tsx
import { defaultCell } from '@/components/easyvision';

{ field: 'created', header: 'Fecha', cell: (row) => defaultCell(formatDate(row.created)) }

// truncated long text — pass the full string as the second arg so it shows on hover
{ field: 'title', header: 'Título', truncate: true, resizable: true,
  cell: (row) => defaultCell(row.title, row.title) }
```

#### Common patterns: do / don't

```tsx
// ✅ Default span — omit `cell` when the raw value is fine.
{ field: 'email', header: 'Email' }

// ❌ Don't reach for `cell` just to render the value.
{ field: 'email', header: 'Email', cell: (r) => <span>{r.email}</span> }

// ✅ Custom renderer — receive the item directly.
{ field: 'status', header: 'Estado', cell: (r) => <Badge>{r.status}</Badge> }

// ❌ Old TanStack-style cell context. The library does NOT pass { row, getValue }.
{ field: 'status', header: 'Estado', cell: ({ row }) => <Badge>{row.original.status}</Badge> }

// ✅ Pure presentational column — use `type: 'ui'` so it's structurally non-sortable
//    and `cell` is required by the type.
{ type: 'ui', field: 'rowMenu', header: '', cell: (r) => <RowActions item={r} /> }

// ❌ Faking a UI column with a data column + sortable: false.
//    Works but generates a wasted accessorFn and breaks if defaultSorting="all".
{ field: 'rowMenu', header: '', cell: (r) => <RowActions item={r} />, sortable: false }

// ✅ Conditional content — return null for nothing.
{ type: 'ui', field: 'infoIcon', header: '',
  cell: (r) => r.info?.trim() ? <InfoIcon text={r.info} /> : null }
```

#### Sorting defaults

Resolution order, top-down:

1. `type: 'ui'` columns are never sortable.
2. Per-column `sortable: false` → off.
3. Per-column `sortable: true` → on.
4. Table-level `defaultSorting` prop (`'disabled' | 'nonNested' | 'all'`, default `'nonNested'`):
   - `'disabled'` → off for every column unless explicitly opted in.
   - `'all'` → every data column sortable, including nested fields.
   - `'nonNested'` → flat fields sortable; nested (dot-path) fields **not** sortable in `api` mode (most APIs can't sort by nested paths). In `local` mode nested fields are sortable since the library handles dot-path comparison.

Use `sortable: true` on a single column to opt back in when your API does support sorting on it.

```tsx
// API supports nested sorting — opt the whole table in.
<EasyVisionTable defaultSorting="all" ... />

// Per-column override, regardless of table-level default.
{ field: 'client.sector', header: 'Sector', sortable: true }
```

#### Column sizing, truncation, and resizing

Three orthogonal column-level options control horizontal layout:

| option | type | effect |
|---|---|---|
| `width` | `number \| string` | Initial width. Number → px, string → any CSS length (`'20%'`, `'12rem'`, `'min(280px, 30%)'`). When omitted, the column auto-sizes to its content. |
| `truncate` | `boolean` | Single-line cell content; overflow becomes an ellipsis. Combine with `defaultCell(content, title)` to expose the full text as a native tooltip on hover. |
| `resizable` | `boolean` | Renders a drag handle on the right edge of the header. The user can drag it to resize the column live; `width` becomes the initial size. The handle has a subtle idle line that lights up on hover/drag and a 12px-wide invisible hit area for easy grabbing. |

```tsx
{
  field: 'title',
  header: 'Título',
  width: 280,
  truncate: true,
  resizable: true,
  cell: (row) => defaultCell(row.title, row.title), // full text on hover
}
```

Resizable widths are tracked by TanStack Table internally and are not persisted — they reset on reload. (If you need persistence, lift the resize state out via `tableInstance.getState().columnSizing`.)

#### Body height & sticky header

`maxBodyHeight` clamps the table body's vertical extent and makes the header `sticky top-0` while rows scroll underneath. Toolbar above and pagination footer below stay outside the scroll region, so the page itself doesn't scroll just because the dataset is long. The same wrapper handles both axes — horizontal overflow (from many or wide columns) and vertical overflow share one scroll container, so scrollbars never overlap each other.

```tsx
<EasyVisionTable maxBodyHeight={500}                   // 500px
<EasyVisionTable maxBodyHeight="60vh"                  // 60% of viewport
<EasyVisionTable maxBodyHeight="min(80vh, 700px)"      // recommended: cap that adapts
<EasyVisionTable maxBodyHeight="clamp(400px, 65vh, 800px)" // floor + cap
```

Recommended pattern: `"min(<vh>, <px>)"`. On most monitors the px cap wins (consistent table size across resolutions); on shorter viewports the vh value kicks in so the table never overflows the visible area. When `maxBodyHeight` is omitted the table grows to its natural height and the page scrolls as before.

Both axes get a thin, theme-aware scrollbar via co-located CSS in [`EasyVisionTable.css`](./table/EasyVisionTable.css), so the styling ships with the component and works in any host project regardless of how that project handles scrollbars globally. Dark mode is detected via `prefers-color-scheme`, a `.dark` ancestor (Shadcn convention), or `[data-theme='dark']`.

#### Pagination footer modes

`paginationDisplay` controls **how** the pagination footer is rendered. It's independent of `paginationMode`, which controls **where** slicing happens (in-memory vs. server). Defaults to `'always'`, so existing tables are unchanged.

| value | rows-per-page selector | item count | page selector + nav |
|---|---|---|---|
| `'always'` (default) | shown | shown | shown |
| `'fixedItemsPerPage'` | hidden | shown | only when `totalCount > itemsPerPage` |
| `'fixedTotalItems'` | hidden | hidden | hidden (entire footer is not rendered) |

```tsx
// Default: full footer
<EasyVisionTable id="users" data={users} columns={cols} />

// Page size is a fixed product choice; pagination appears only on overflow.
// Item count stays visible so users still see "X results".
<EasyVisionTable
  id="dashboard-alerts"
  data={alerts}
  columns={cols}
  itemsPerPage={5}
  paginationDisplay="fixedItemsPerPage"
/>

// Short, naturally-bounded list (a product's plans, conditions, …).
// All rows render in one page; the footer is gone entirely.
<EasyVisionTable
  id="product-plans"
  data={plans}
  columns={cols}
  itemsPerPage={9999}
  paginationDisplay="fixedTotalItems"
/>
```

Notes:
- For `'fixedTotalItems'`, pair with a large `itemsPerPage` so every row actually renders — the prop hides the controls but doesn't change the page size.
- For `'fixedItemsPerPage'`, the rows-per-page *selector* is hidden because "fixed" implies the size is a deliberate setting; the underlying `itemsPerPage` slice value still drives slicing as usual.
- API mode (`paginationMode="api"`) works with all three values. In `'fixedItemsPerPage'`, the server still receives the configured `itemsPerPage`; nav controls just don't surface until `totalCount` exceeds it.

### Selection

```tsx
<EasyVisionTable
  enableRowSelection
  selectAllScope="toggleable"        // 'page' | 'all' | 'toggleable'
  // getRowId defaults to (row) => String(row.id) — override only for non-standard shapes
  onSelectionChange={(event) => {
    // event always exposes ids[] and rows[] regardless of scope/mode.
    pushIds(event.ids);
    pushRows(event.rows);
  }}
/>
```

**`SelectionChange<T>` event:**

```ts
type SelectionChange<T> =
  | { scope: 'page'; ids: string[]; rows: T[] }
  | { scope: 'all'; mode: 'in-memory'; ids: string[]; rows: T[] }
  | { scope: 'all'; mode: 'wildcard'; ids: string[]; exceptIds: string[]; rows: T[] };
```

`ids` and `rows` are always present so simple consumers don't need to narrow:
- `page` — selected ids/rows on the current page.
- `all` `in-memory` (local pagination) — every row in `data`.
- `all` `wildcard` (api pagination) — current page rows minus `exceptIds`. The full match is server-side; pair `exceptIds` with the table's filter for backends that accept "match-all-with-exceptions" semantics (`DELETE /things?match=<filter>&except=...`).

`'toggleable'` is the default UX: a chevron next to the header checkbox lets the user switch between "select page" and "select all". When the bound multifilter performs a new search, an `'all'` selection is cleared automatically (it would otherwise be stale).

#### `selectAllResolution`: lazy vs eager vs eager-ids wildcard

By default, "select all matching" in api mode emits a `wildcard` event (the host page is responsible for materializing the full id list when needed). Pages that need the full id list **up front** — e.g. to preview, reorder, or run in-memory transforms before submitting — can opt into eager resolution:

```tsx
<EasyVisionTable
  enableRowSelection
  selectAllResolution="eager"     // 'lazy' (default) | 'eager' | 'eager-ids'
  onSelectionChange={(event) => {
    // In eager mode, wildcard becomes mode: 'in-memory' with the full id list.
    setSelectedIds(event.ids);     // ← always complete; no resolveSelection helper needed
  }}
  loopback={{ ... }}
/>
```

What changes in `'eager'` mode (api only):
- The moment the user enters `'all'` scope, the table paginates `fetchData` with the active filter and captures every matching id.
- The selection banner shows a spinner + "Cargando…" while resolving.
- Once resolved, `onSelectionChange` fires with `{ scope: 'all', mode: 'in-memory', ids: [...full], rows: [...full] }` (no `exceptIds`, no `wildcard`).
- **Column sorting is locked while a wildcard selection is active** — otherwise the captured id order would silently desync from the rendered view. Clearing the selection unlocks sort.
- The cache is invalidated on multifilter perform, on `refetchSignal` change, and when leaving `'all'` scope; the next entry re-materializes.

`'eager-ids'` is the same flow as `'eager'` but drops row objects during pagination — only the id list is materialized:

```tsx
<EasyVisionTable
  enableRowSelection
  selectAllResolution="eager-ids"
  onSelectionChange={(event) => {
    if (event.scope === 'all' && event.mode === 'in-memory-ids') {
      // event.ids is the full set. event.rows does not exist on this variant —
      // TypeScript will error if you try to read it.
      deleteByIds(event.ids);
    }
  }}
  loopback={{ ... }}
/>
```

Use `'eager-ids'` when the consumer only needs ids (bulk action by id, export by id, submit-by-id) and selections can reach the tens of thousands — `'eager'` would carry every row object across all pages, which is wasteful at that scale.

**Wire-level payload reduction.** During eager-ids resolution the table sets `idsOnly: true` on each `fetchData` call. The built-in loopback adapter honors this by requesting `fields: ['id']` and dropping `include` for those calls — so the server returns only id objects, not full rows, dramatically shrinking the network payload for large selections. Custom `fetchData` implementations can read `params.idsOnly` and apply the same optimization (or ignore it — they'll still work, just sending more bytes than needed). The loopback adapter accepts an `idFields?: string[]` option (defaults to `['id']`) if your model's primary key is named differently.

Trade-offs:

| Mode | Network on select-all | Memory per selection | Reorder while selected | Untick individual rows | Best for |
|---|---|---|---|---|---|
| `'lazy'` (default) | none | O(page) | free | via `exceptIds` | export / submit flows; no list manipulation |
| `'eager'` | one paginated sweep, full rows | O(all ids + all rows) | locked | via header toggle (adds visible rows to `exceptIds`) | preview / reorder / transform before submit; one-line consumer code |
| `'eager-ids'` | one paginated sweep, **ids only** (loopback adapter) | O(all ids only) | locked | via header toggle (adds visible rows to `exceptIds`) | bulk action by id at scale (50k+); consumer only needs ids |

Has no effect when `paginationMode === 'local'` (the table already knows the full set).

**Selection banner.** A banner appears whenever there is *any* selection, in either scope:
- page-scope with N rows selected → `"N registros seleccionados"` + **Limpiar selección**
- all-scope → `"Todos los N registros seleccionados"` + **Limpiar selección**

Clicking *Limpiar selección* always resets to an empty page-scope selection — letting users wipe selections accumulated across pages in one click without changing modes. Override the labels via `labels.selectedCountBanner` and `labels.selectedAllBanner`.

The `'wildcard'` event in API mode is meant for backends that accept "match-all-with-exceptions" semantics — e.g. `DELETE /things?match=<filter>&except=...`.

### Highlighting rows (master/detail)

For master/detail layouts where clicking a row updates a side panel, use `isRowHighlighted` to mark the active row independently of selection:

```tsx
const [activeId, setActiveId] = useState<string | null>(null);

<EasyVisionTable
  onRowClick={(row) => setActiveId(row.id)}
  isRowHighlighted={(row) => row.id === activeId}
  /* ... */
/>
```

Highlighted rows get a `bg-muted/50` tint plus `data-highlighted="true"` on the `<tr>` for custom styling.

### Binding a multifilter

Pass a multifilter declaration via the `multifilter` prop. It auto-mounts in the toolbar and inherits the table's namespace. A perform resets `page = 1`, stores the snapshot, and refetches (api) or applies the where-clause client-side (local).

**Perform timing is auto-selected.** Unless you pass an explicit `performMode`, the bound multifilter resolves `'auto'` to:

- `'live'` when `paginationMode === 'local'` — filters apply as the user picks, no Buscar button needed.
- `'manual'` when `paginationMode === 'api'` — values stage until the user clicks Buscar (or you call `ref.current.perform()`), so you don't fire one request per keystroke.

Override per-table with `multifilter.performMode = 'live' | 'manual'`. Add `multifilter.performDebounceMs` to collapse rapid changes in live mode (useful for `type: 'text'` fields — pair with the input's own `debounceMs` if you want both layers).

```tsx
<EasyVisionTable<Alert>
  id="alerts"
  paginationMode="api" orderingMode="api"   // → manual perform by default
  fetchData={fetchAlerts}
  getRowId={(a) => a.id}
  multifilter={{
    id: 'mainFilter',
    performButton: true,                     // explicit Buscar UI for the manual flow
    config: {
      fields: [
        { id: 'q', type: 'text', field: 'client.name', label: 'Búsqueda', prominent: true, pinned: true },
        /* ... */
      ],
    },
  }}
  columns={[/* ... */]}
/>

<EasyVisionTable<Bank>
  id="banks"
  paginationMode="local" orderingMode="local"  // → live perform by default
  data={banks}
  multifilter={{
    id: 'banksFilter',
    performDebounceMs: 150,                    // optional; smooths rapid edits
    config: { fields: [/* ... */] },
  }}
  columns={[/* ... */]}
/>
```

### External filter and manual refetch

When the filter UI lives **outside** the table — a custom search panel, URL query params, parent-screen state, etc. — use `externalFilter` and `refetchSignal` instead of the bound `multifilter`.

```tsx
const [activeFilter, setActiveFilter] = useState<{ where?: Record<string, unknown> }>({});
const [refetchSignal, setRefetchSignal] = useState(0);

const onSearch = () => {
  setActiveFilter(buildWhereFromMyPanel());
  setRefetchSignal((s) => s + 1);   // forces refetch even if `where` reference is stable
};

<EasyVisionTable
  paginationMode="api"
  orderingMode="api"
  fetchData={fetchData}
  externalFilter={activeFilter}
  refetchSignal={refetchSignal}
  /* ... */
/>
```

- **`externalFilter: { where?: Record<string, unknown> }`** — merged into every `fetchData({ filter })` call. Whenever its reference changes, the table refetches.
- **`refetchSignal: unknown`** — changing this value forces a refetch and **resets `page` to 1** (mirroring the multifilter Buscar semantics). Useful when (a) `externalFilter` reference is stable but you want to re-query, or (b) an out-of-band event (e.g. a detail panel saving changes) should refresh the table.
- **Both can coexist with a bound `multifilter`.** The `where` from each is shallow-merged; **multifilter wins on key collisions**, so it can override the external filter.
- **Selection is not auto-cleared.** Unlike the bound multifilter (which clears `'all'`-scope selections on Buscar), the external-filter path leaves selection alone. If your UX needs it cleared on a new external search, do it explicitly:
  ```ts
  easyVisionRegistry.getState().patch<'table'>(`${tableId}-table`, {
    selection: { ids: {}, scope: 'page' },
  });
  ```

### Toolbar slots

`toolbarLeft` and `toolbarRight` are arbitrary `ReactNode` slots in the table's toolbar bar (rendered above the column headers, alongside the column-visibility menu). Use them for action menus, bulk-action buttons, export controls, custom legends — anything pinned to the table chrome.

```tsx
<EasyVisionTable
  toolbarLeft={<ActionManager actions={actions} />}
  toolbarRight={<Button onClick={openSettings}>Ajustes</Button>}
  /* ... */
/>
```

The toolbar row is hidden entirely when none of `toolbarLeft`, `toolbarRight`, or `showColumnVisibility` produce content.

### Table props

| prop | type | default |
|---|---|---|
| `id` | `string` | — required |
| `columns` | `EasyVisionColumn<T>[]` | — required |
| `paginationMode` | `'local' \| 'api'` | `'local'` |
| `orderingMode` | `'local' \| 'api'` | `'local'` |
| `defaultSorting` | `'disabled' \| 'nonNested' \| 'all'` | `'nonNested'` |
| `data` | `T[]` | — for local mode |
| `fetchData` | `(params) => Promise<{rows, totalCount}>` | — for api mode |
| `loopback` | `CreateLoopbackTableFetcherOptions<T>` | — declarative LoopBack shortcut; auto-builds `fetchData` and forces `paginationMode`/`orderingMode` to `'api'` (see [API adapters: LoopBack](#api-adapters-loopback)) |
| `onDataLoaded` | `(rows, totalCount) => void` | — fires after every successful API fetch; mirror the loaded slice into another store without wrapping `fetchData` |
| `multifilter` | `EasyVisionMultifilterProps` | — |
| `externalFilter` | `{ where?: Record<string, unknown> }` | — merged into every fetch |
| `localMatch` | `(row, where) => boolean` | `matchLoopbackWhere` — local-mode predicate; override or compose to extend the DSL (see [Local mode filtering](#local-mode-filtering-with-the-same-dsl--matchloopbackwhere)) |
| `refetchSignal` | `unknown` | — changing it refetches and resets `page` to 1 |
| `getRowId` | `(row) => string` | `(row) => String(row.id)` — override only for non-standard shapes |
| `itemsPerPage` | `number` | `10` |
| `itemsPerPageOptions` | `number[]` | `[10, 15, 20]` |
| `paginationDisplay` | `'always' \| 'fixedItemsPerPage' \| 'fixedTotalItems'` | `'always'` — footer rendering mode; see [Pagination footer modes](#pagination-footer-modes) |
| `enableRowSelection` | `boolean` | `false` |
| `selectAllScope` | `'page' \| 'all' \| 'toggleable'` | `'toggleable'` |
| `selectAllResolution` | `'lazy' \| 'eager' \| 'eager-ids'` | `'lazy'` — `'eager'` materializes the full id list + rows on wildcard select-all (locks sort); `'eager-ids'` is the same but skips row materialization, for bulk-by-id flows at scale |
| `onSelectionChange` | `(event) => void` | — |
| `isLoading` | `boolean` | `false` |
| `emptyMessage` | `string` | labels.noData |
| `emptyAction` | `ReactNode` | — |
| `onRowClick` | `(row) => void` | — |
| `isRowHighlighted` | `(row) => boolean` | — |
| `toolbarLeft`, `toolbarRight` | `ReactNode` | — |
| `showColumnVisibility` | `boolean` | `true` |
| `maxBodyHeight` | `number \| string` | — clamps body height (number → px, string → any CSS length); makes the header sticky and contains both-axis scroll inside the table |
| `labels` | `Partial<TableLabels>` | Spanish defaults |
| `className`, `persist` | | |

The table slice persists `page`, `itemsPerPage`, `sort`, and `selection` — set `persist={true}` to keep them across mount/unmount.

#### `TableLabels` keys

All user-visible strings on the table. Pass any subset via `labels`.

```ts
interface TableLabels {
  rowsPerPage: string;                       // 'Resultados por página'
  results: string;                           // 'Resultados'
  page: string;                              // 'Página'
  of: string;                                // 'de'
  noData: string;                            // 'Sin resultados'
  loading: string;                           // 'Cargando...'
  customizeColumns: string;                  // 'Personalizar columnas'
  selectAllPage: string;                     // 'Seleccionar página'
  selectAllAll: string;                      // 'Seleccionar todo'
  selectedCountBanner: (n: number) => string;// '{n} registros seleccionados'
  selectedAllBanner: (n: number) => string;  // 'Todos los {n} registros seleccionados'
  clearSelection: string;                    // 'Limpiar selección'
}
```

---

## `EasyVisionExportButton`

Writes one or more registered tables into a single `.xlsx` file, one worksheet per table. It doesn't hold any data itself — every mounted `EasyVisionTable` registers an **export source** (a pair of resolvers: columns and rows) keyed by its `fullId`, and the button just looks those up by the ids you pass in `tables`.

### Minimal usage

```tsx
<EasyVisionExportButton
  tables={['localTable', 'apiTable']}
  sheetNames={{ localTable: 'Local', apiTable: 'API' }}
  filename="risk-evaluations"
/>
```

Clicking it resolves `localTable` and `apiTable` against the tables mounted nearby, pulls each one's current rows and visible columns, and downloads `risk-evaluations_<ISO timestamp>.xlsx` with two sheets named `Local` and `API`. A table id with no `sheetNames` override falls back to the table's own `id` as the sheet name.

### Props

| prop | type | default | notes |
|---|---|---|---|
| `tables` | `string[]` | — required | Table ids, in sheet order. See [Resolving table ids](#resolving-table-ids) below. |
| `filename` | `string` | — required | Base name. An ISO timestamp and `.xlsx` are appended. |
| `sheetNames` | `Record<string, string>` | — | Per-table sheet-name override, keyed by the same id passed in `tables`. Sheet names are sanitized (invalid Excel characters replaced with `-`, truncated to 31 chars) and de-duplicated automatically. |
| `labels` | `Partial<ExportLabels>` | Spanish defaults | `{ export, exporting }` — button text for idle and in-flight states. |
| `onError` | `(error: unknown) => void` | — | A fetch or workbook-building failure aborts the whole export — no partial file is written. Also fires when *some but not all* ids in `tables` fail to resolve, with an `Error` naming the unresolved ids — this catches a typo'd or unmounted table id before it can silently drop a sheet from an otherwise-successful export. |
| `onEmpty` | `() => void` | — | Fires when nothing was written: **no** id in `tables` resolved to a mounted table (every id failed together, e.g. the button rendered before any table mounted), or every sheet that did resolve had zero visible columns or zero matching rows. A *partial* resolution failure — some ids resolved, some didn't — is reported via `onError` instead, not `onEmpty`, so it isn't mistaken for "nothing to export". The button does **not** disable itself when a table id fails to resolve or a table has nothing to export — it always attempts the export and reports the outcome via `onEmpty` / `onError`, since a source can legitimately empty out between renders (a hidden column, a narrowed multifilter, an unmounted table). |
| `disabled` | `boolean` | `false` | External disable, e.g. while a parent form is invalid. |
| `className` | `string` | — | |
| `icon` | `ReactNode` | a download icon | Replaces the default idle-state icon. The spinner shown while exporting is not overridable. |

### What gets exported

**Rows** are the ticked selection when there is one — page-scope ids, or an all-scope selection minus any `exceptIds` — and otherwise every row matching the table's current multifilter plus `externalFilter`. To assemble "every row" in API mode, the export first pages through `fetchData` under the hood to collect the complete matching set (the same helper `selectAllResolution="eager"` uses internally), then applies the selection filter to it — so an export is never limited to whatever page happens to be on screen, and behaves the same regardless of the table's `selectAllResolution` setting. Local mode already holds the filtered set in memory, so no extra fetching happens there.

**Columns** are the table's currently visible, exportable columns, in declared order. Concretely:
- A column must pass `isVisible` — the same visibility state `ColumnVisibilityMenu` (the **Columnas** button in the table toolbar) toggles. Hide a column there and it's gone from the sheet; show it and it reappears. This makes `ColumnVisibilityMenu` double as export column customization — there is no separate export-column picker.
- A column must be exportable: `data` columns are exportable by default, `ui` columns are not (a `ui` column has no underlying value — opt it in with `exportable: true` plus an `exportValue` to export something computed).
- **`largeScreensOnly` columns always export**, even when the viewport is too narrow to render them. `largeScreensOnly` is a CSS-only responsive hint — it never enters the visibility state — so if it affected the export, the same click would produce a different file on a phone than on a wide monitor. Hide a column from exports on purpose with `exportable: false` instead.

Both resolvers run at export-click time, not at table-mount time, so a column toggle, a fresh multifilter query, or a changed selection made a second before clicking is always reflected — nothing needs to be re-registered.

### Resolving table ids

The button must render **inside the same namespace as the tables it names**. An id in `tables` is qualified through the surrounding namespace first, the same way a nested multifilter field is (see [The `id` rule](#the-id-rule)): `'localTable'` becomes `localTable-table` when the button sits at the top level (no enclosing namespace), or `parentId.localTable-table` when it's nested under something with `id="parentId"`.

Rendering the button as a plain sibling of the tables — as in the demo — is the simple case: both the tables and the button see the same (usually empty) surrounding namespace, so local ids just work.

Rendering it **inside a table's own `toolbarLeft` / `toolbarRight`** (a natural spot per [Toolbar slots](#toolbar-slots)) is different: that slot renders inside *that table's* namespace, so a local id would be qualified as `<hostTableId>-table.<name>-table` — which never matches, even for the table hosting the button itself. In that placement, pass the target table's **fully-qualified id** instead (its own `id` with `-table` appended, e.g. `'orders-table'`).

Resolution is always **namespace-first**: the id is qualified through the surrounding namespace and looked up under that name first; only if that lookup misses is the raw id tried verbatim as a fallback. A fully-qualified id (one already ending in `-table`) doesn't *bypass* namespace resolution — the namespaced probe still runs first and would win if it happened to match — it just normally misses (a genuine local id doesn't already carry a `-table` suffix), so the fallback is what actually resolves it. This fallback is the escape hatch for exporting a table the button can't reach by local-id lookup, including the table it's nested inside.

If the target table is itself nested under another namespaced component, its fully-qualified id is the **full chain**, not just its own `id` with `-table` appended: a table declared with `id="orders"` inside something with `id="page"` registers as `page-table.orders-table`, so that's the string to pass — `'orders-table'` alone won't match it.

---

## Migration cookbook

Use this when replacing an existing filter panel or table with EasyVision components. The mappings below cover the most common shapes — TanStack-based and prop-driven implementations — but the pattern generalizes.

### From a prop-driven filter panel → `EasyVisionMultifilter`

If your existing panel takes an array of filter definitions and emits a query when the user presses Search, the mapping is mechanical:

| existing concept | EasyVision equivalent |
|---|---|
| top-level component (`<FilterPanel config={...} onSearch={...} />`) | `<EasyVisionMultifilter id="..." config={...} performButton onPerform={...} />` |
| `config.filters[]` (array of definitions) | `config.fields[]` (same idea — see [Field types](#field-types)) |
| `definition.required` | `definition.mandatory` |
| `definition.field` (API path) | `definition.field` (same) |
| `definition.transform` (per-field where-builder) | `definition.toCondition` (same signature; the legacy name `transform` is still accepted as an alias) |
| `config.searchField` (top search bar) | `prominent: true, pinned: true` on a `type: 'text'` field in `config.fields[]` (or, for back-compat, `config.searchField` — deprecated). |
| `initialFilters` / `initialActiveFilters` (restored from a global store) | `persist={true}` + the slice survives mount cycles automatically |
| `onStateChange` (mirroring to global state) | `onStateChange` (same; or rely on the registry directly) |
| `onRefresh` button | n/a — pressing Buscar refetches; or call `ref.current?.perform()` |

Concepts that need new wiring:

- **Pinned vs chip vs locked.** EasyVision splits the row into a pinned-area (always visible, no `+`/X) and a chip-area (added via `+`, removed via X). Annotate each field with `pinned: true` or `locked: true` to control which area it lives in.
- **`editable={false}`** disables the entire add/remove UI for a fully-static layout.
- **Buscar dirty + mandatory gating.** The button is enabled only when every `mandatory` field has a value AND the snapshot differs from the last confirmation. There is no manual "isValid" prop to drive — the library computes it.
- **Nesting.** Sub-panels become a `{ type: 'multifilter', config: {...} }` field rather than a separately-mounted component.

### From a TanStack-based table → `EasyVisionTable`

Most TanStack column definitions transfer directly:

| existing | EasyVision |
|---|---|
| `ColumnDef<T>[]` with `accessorKey`, `header`, `cell` | `EasyVisionColumn<T>[]` — use `field` instead of `accessorKey` (the library auto-generates the accessor). `cell` receives the row item directly: `cell: (item) => ReactNode`. |
| `accessorFn: (row) => row.foo.bar` | drop — `field: 'foo.bar'` resolves dot paths automatically. |
| `enableSorting: false` on nested fields | drop it — automatic in `api` mode (governed by `defaultSorting`, default `'nonNested'`). Use `sortable: true` per column to opt back in, or `defaultSorting="all"` for the whole table. |
| `manualPagination`, `manualSorting`, `pageCount`, etc. | not needed — set `paginationMode` and `orderingMode` and the table manages it. |
| `getRowId` | same. Defaults to `(row) => String(row.id)`; override for rows without a top-level `id`. |
| `state.sorting` + `onSortingChange` controller | gone — sort state lives in the table's slice; no controller plumbing required. |
| `state.rowSelection` + `onRowSelectionChange` controller | use `onSelectionChange` for emission only; selection state is managed internally. |
| Hand-rolled "select all on page" via `toggleAllPageRowsSelected` | `enableRowSelection` + `selectAllScope="page"` (default `'toggleable'` adds an "all-rows" mode). |
| Hand-rolled column-visibility menu | built-in; toggle with `showColumnVisibility` (default `true`). Use `initiallyHidden: true` on a column to hide it by default. |
| External `useFilteredDataTable` / pagination hook | replaced by `paginationMode="api"` + `fetchData`. Inside `fetchData` you receive `{ page, itemsPerPage, sort, filter }`. |

### From a hand-rolled table with local pagination/order → `EasyVisionTable`

| existing | EasyVision |
|---|---|
| `startIndex` / `itemsPerPage` slicing on a full array | `paginationMode="local"` and pass `data={fullArray}`. Slicing happens internally. |
| Local sort callback + sort state | `orderingMode="local"`. The library sorts by resolving the column's `field` (dot paths supported) with a numeric-in-string heuristic. For fully custom comparators, use a `type: 'ui'` column or sort the `data` array yourself before passing it in. |
| Toggling between "API mode" and "local DB mode" via a global flag | the two modes are independent props (`paginationMode` and `orderingMode`); flip one or both at the call site. |
| `disableorder` per column | `sortable: false`. |
| Force-enabling order on a nested column | `sortable: true` (per column) or `defaultSorting="all"` (whole table). |

### Common adjustments

- **Add `getRowId`** to every table that uses selection. Without it, TanStack uses array indices and selections appear to "jump" when the page changes.
- **Drop the auth/page reset boilerplate.** Selections clear automatically when a bound multifilter performs. Page resets to 1 automatically on Buscar. Persist these via `persist={true}` if you want them kept across mount cycles.
- **Inline filter values become declarative.** Instead of `useState`-driven filter state and `useEffect`-driven refetches, declare the filters in `multifilter.config.fields` and let `onPerform` drive your fetch.

---

## Integration recipes

### API adapters: LoopBack

Most backends in this project speak LoopBack (`GET /resource?filter={...}` + `GET /resource/count?filter={...}`). The library ships a first-class adapter for it: a `loopback` prop on `EasyVisionTable` (the recommended path) and a lower-level `createLoopbackTableFetcher` factory (when you need full control).

#### Recommended: the `loopback` prop

The shortest possible setup. Pass your two LoopBack endpoints declaratively; the table builds its own `fetchData`, forces `paginationMode` and `orderingMode` to `'api'`, and you never see the order/skip/where plumbing.

```tsx
import { EasyVisionTable } from '@/components/easyvision';
import { fetchAlertsByFilter, countAlertsByFilter } from '@/adapters/api/alertsApi';

const ALERT_FIELDS = ['id', 'created', 'scoring', /* ... */];
const ALERT_INCLUDE = [{ relation: 'client' }];

<EasyVisionTable<Alert>
  id="alerts"
  persist
  columns={columns}
  loopback={{
    fetchPage: fetchAlertsByFilter,    // (filter) => Promise<Alert[]>
    fetchCount: countAlertsByFilter,   // (filter) => Promise<{ count }>
    include: ALERT_INCLUDE,
    fields: ALERT_FIELDS,
    defaultOrder: ['created DESC'],
  }}
  /* ... */
/>
```

The `loopback` prop is content-stable: the table compares `fetchPage`/`fetchCount` by reference and `include`/`fields`/`defaultOrder` by value, so passing an inline literal won't cause spurious refetches. No `useMemo` required at the call site.

The effect of providing `loopback`:

- `paginationMode` and `orderingMode` are forced to `'api'`.
- `fetchData` is auto-generated from the options.
- An explicit `fetchData` prop wins if both are present (escape hatch for custom queries on the same page).

#### Lower-level: `createLoopbackTableFetcher`

When you need to inspect, wrap, or compose the fetcher (e.g. instrument it, add logging, inject a tenant filter), use the factory directly and pass the result to `fetchData`:

```tsx
import {
  EasyVisionTable,
  createLoopbackTableFetcher,
} from '@/components/easyvision';

const fetchData = useMemo(
  () =>
    createLoopbackTableFetcher<Alert>({
      fetchPage: fetchAlertsByFilter,
      fetchCount: countAlertsByFilter,
      include: ALERT_INCLUDE,
      fields: ALERT_FIELDS,
      defaultOrder: ['created DESC'],
    }),
  []
);

<EasyVisionTable id="alerts" persist paginationMode="api" orderingMode="api"
  columns={columns} fetchData={fetchData} /* ... */ />
```

The factory (and the `loopback` prop):
- map the table's sort to LoopBack `order` (fall back to `defaultOrder` when no sort is active);
- compute `skip = (page - 1) * itemsPerPage`;
- forward `where` from the merged filter (multifilter ∪ external);
- issue rows + count requests in parallel;
- only send `where` to the count endpoint (LoopBack ignores the rest).

#### Importing LoopBack types

The adapter also exports the LoopBack `Filter` shape for hand-rolled queries (e.g. inside a custom `toCondition` on a multifilter field, or for one-off API calls):

```tsx
import type { LoopbackFilter, LoopbackWhereValue } from '@/components/easyvision';

const filter: LoopbackFilter = {
  where: { status: { $in: ['VALIDATED', 'PENDING'] } },
  fields: ['id', 'status'],
  limit: 50,
};
```

The library makes no assumptions about how the HTTP requests are issued — `fetchPage` and `fetchCount` are plain async functions. Bring your own auth, base URL, error handling, etc.

For non-LoopBack backends, inline a custom `fetchData` — see [Adapting an arbitrary API response](#adapting-an-arbitrary-api-response) below — or contribute a sibling adapter (e.g. `adapters/westack.ts`) following the same pattern.

#### Local mode filtering with the same DSL — `matchLoopbackWhere`

A multifilter authored once should work the same whether it drives an API call or filters an in-memory array. The library ships `matchLoopbackWhere` — a pure evaluator for the LoopBack `where` DSL — and `EasyVisionTable` uses it as the **default** local-mode filter. No extra props are needed for the common case.

Supported operators: `$eq`, `$ne` / `$neq`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, `$regex` (with `$options`), `$exists`, plus `$and` / `$or` / `$not` and arbitrary-depth dotted paths with array fan-out.

##### 1. Default — the table filters internally

Just pass `data` and a `multifilter`. When the user clicks Buscar, the table runs `data.filter(row => matchLoopbackWhere(row, where))` before sort + pagination.

```tsx
<EasyVisionTable<Alert>
  id="alerts-local"
  data={alerts}
  columns={columns}
  multifilter={{
    id: 'mainFilter',
    performButton: true,
    config: alertFilterConfig,    // same config as the API path
  }}
/>
```

##### 2. Override (or compose) with `localMatch`

Need extra rules — feature flags, derived fields, hybrid logic? Pass `localMatch`. Compose with the default to keep the DSL working and add behavior on top:

```tsx
import { EasyVisionTable, matchLoopbackWhere } from '@/components/easyvision';

<EasyVisionTable<Product>
  id="products"
  data={products}
  columns={columns}
  multifilter={{ id: 'productFilter', performButton: true, config }}
  localMatch={(row, where) =>
    matchLoopbackWhere(row, where) && productIsValid(row)
  }
/>
```

Or replace it entirely with a hand-written predicate for a non-LoopBack DSL:

```tsx
<EasyVisionTable
  data={items}
  multifilter={multifilterProps}
  localMatch={(row, where) => myCustomMatcher(row, where)}
/>
```

##### 3. Standalone — use it anywhere

`matchLoopbackWhere` is a pure function with no React or project dependencies. Use it inside selectors, hooks, charts, export builders — anywhere you'd otherwise hand-write equivalent JS:

```tsx
import { matchLoopbackWhere } from '@/components/easyvision';

// In a memoized selector:
const visibleAlerts = useMemo(
  () => alerts.filter(a => matchLoopbackWhere(a, where)),
  [alerts, where]
);

// Counting matches without rendering them:
const count = rows.reduce((n, r) => n + (matchLoopbackWhere(r, where) ? 1 : 0), 0);

// Composing with non-DSL business rules:
const eligible = banks.filter(
  b => matchLoopbackWhere(b, where) && hasProductType(b, '', '') > 0
);
```

Behavior on edge cases:
- `undefined` or empty `where` → matches everything (no filter active).
- Unknown `$operator` → `false` (fail-closed; surfaces typos early).
- Plain-object equality (`{ a: { b: 1 } }`) is not supported — use dotted paths (`'a.b'`) or `$and`.

### Adapting an arbitrary API response

`fetchData` must return `{ rows: T[]; totalCount: number }`. Wrap whatever shape your backend gives you:

```tsx
fetchData={async ({ page, itemsPerPage, sort, filter }) => {
  const res = await api.list({
    skip: (page - 1) * itemsPerPage,
    limit: itemsPerPage,
    order: sort ? `${sort.column} ${sort.descending ? 'DESC' : 'ASC'}` : undefined,
    where: filter?.where,
  });
  return { rows: res.data, totalCount: res.meta.totalItems };
}}
```

For a backend that returns `{ items, page, pages, total }`:

```tsx
return { rows: res.items, totalCount: res.total };
```

For a backend that returns no total (cursor-pagination), pass a synthetic `totalCount` and disable the page selector with a custom `labels` override or `showColumnVisibility={false}` style trimming. (True cursor support is on the deferred list.)

### Translating to a different filter dialect

The default `query.where` uses a flat `{ [field]: condition }` shape with `$regex / $in / $gte / $lte`. To emit something else (e.g. a different operator name or a wrapped `$or`/`$and` group), use **per-field `toCondition`**:

```ts
{
  id: 'amount', type: 'numberRange', field: 'amount', label: 'Importe',
  // emit { $gte, $lte_or_whatever_your_api_uses }
  toCondition: (v: { min?: number; max?: number }) => ({
    $gte: v.min,
    $lte_or_whatever: v.max,
  }),
}
```

Or transform the whole snapshot at the call site:

```tsx
onPerform={(snap) => {
  const apiWhere = mySnapshotToApiAdapter(snap);
  fetch('/api/items', { body: JSON.stringify({ where: apiWhere }) });
}}
```

A reusable adapter (e.g. converting EasyVision's flat `where` into a recursive `$or/$and` filter group) belongs **next to the call site or in a small `adapters/` module**, not inside the multifilter — keeps the library dialect-agnostic.

### Tearing down state on logout / route exit

Slices are cleaned up automatically when their owning component unmounts (unless `persist={true}`). To wipe everything explicitly — say on logout — use the registry directly:

```ts
import { easyVisionRegistry } from '@/components/easyvision';

function logout() {
  await api.logout();
  easyVisionRegistry.getState().reset();   // drop every slice
  navigate('/login');
}
```

To drop a single subtree (e.g. forcing one table back to its default state):

```ts
easyVisionRegistry.getState().drop('alerts-table');   // also drops every descendant slice
```

### Reading state from outside React

Useful for export buttons, page-level "have any filters changed?" checks, etc.

```ts
import { getSlice, easyVisionRegistry } from '@/components/easyvision';

// Export selected rows.
const tableSlice = getSlice<'table'>('alerts-table');
const selectedIds = Object.keys(tableSlice?.selection.ids ?? {});

// Watch for any change in the registry (rare; usually onChange/onPerform is enough).
const unsub = easyVisionRegistry.subscribe((state) => {
  console.log(state.slices);
});
unsub();   // remember to unsubscribe
```

### Persistence patterns

| goal | how |
|---|---|
| Keep filter & page across in-app navigation | `persist={true}` on the multifilter and/or table. Slices survive mount/unmount of the page that hosts them. |
| Reset when the parent entity changes | `clearWhen={(snapshot) => parentId !== lastSeen.current}` |
| Reset everything on logout | `easyVisionRegistry.getState().reset()` (see above) |
| Reset when the URL changes | `clearWhen={() => location.pathname !== savedPath}` or call `drop(fullId)` in a route effect |
| Keep across browser reloads | not built-in for v1 — wire your own `localStorage` adapter using `easyVisionRegistry.subscribe` + `getSlice` |

### Localizing user-visible strings

Every component accepts `labels?: Partial<Labels>`. The defaults are Spanish; pass any subset:

```tsx
<EasyVisionMultifilter
  labels={{ perform: t('filters.search'), clear: t('common.clear') }}
  /* ... */
/>
<EasyVisionTable
  labels={{
    rowsPerPage: t('table.rowsPerPage'),
    of: t('common.of'),
    selectedAllBanner: (n) => t('table.selectedAll', { count: n }),
  }}
  /* ... */
/>
```

The library never imports a translation framework directly, so it's compatible with `react-i18next`, `react-intl`, plain dictionaries, or anything else.

---

## Gotchas

Things that bit us during development and are easy to miss at integration time.

### Layout

- **Tables inside a CSS grid get cut off.** CSS grid items default to `min-width: auto`, which means they expand to fit their content rather than letting the table's `overflow-auto` engage. Add `min-w-0` to each grid cell that hosts a table:

  ```tsx
  <div className="grid grid-cols-2 gap-4">
    <div className="min-w-0"><EasyVisionTable {...} /></div>
    <div className="min-w-0"><EasyVisionTable {...} /></div>
  </div>
  ```
  The same fix applies to flex containers (`min-w-0` on flex children that should shrink).

- **Horizontal scrollbars don't appear if the host project hides scrollbars globally.** The library imports `easyvision.css` which re-enables scrollbars on its own scroll containers (`.easyvision-table-scroll`). If you also want vertical scrollbars to be visible, target the same class or add a similar override at the host level.

- **The selection column is `60px` wide by default** to fit checkbox + chevron in `selectAllScope="toggleable"`. If you only ever use `'page'` mode you can ignore this.

### Selection

- **`getRowId` is required when `enableRowSelection`.** Without it, TanStack uses row indices, and selections won't persist across page changes (the row at index 0 on page 2 is a different entity than the row at index 0 on page 1).
- **Selection persists across pages by design.** Earlier behaviour was to clear on page change — that's a bug; the current behaviour matches what users expect.
- **`'all'` scope in API mode emits `mode: 'wildcard'`.** That's because the API hasn't loaded all rows; the event tells you "select everything that matches the current filter, except these explicit ids". If your backend can't honour that contract, prefer `selectAllScope="page"`.
- **Selection clears automatically only for the `'all'` scope** when the bound multifilter performs a new search (the previous "all" is stale). Page-scope selections stay; the user opted into them explicitly.

### Ordering

- **Nested-field columns are non-sortable in API mode by default.** Detection is `field.includes('.')`, controlled by the table-level `defaultSorting` prop (default `'nonNested'`). If your backend can sort by nested paths, either set `sortable: true` per column or `defaultSorting="all"` on the table. To force-disable ordering on a non-nested column, use `sortable: false`.
- **`type: 'ui'` columns are never sortable** — they have no underlying value to compare. If you need a sortable derived value, use a `type: 'data'` column with a `cell` renderer instead.
- **Local sort uses a numeric-in-string heuristic.** Strings like `"Plan 12"` sort by their numeric prefix. If that surprises you, sort the `data` array yourself before passing it in.

### Multifilter

- **Buscar disables itself when you "undo" your edits.** Editing a value back to the last confirmed snapshot is treated as a no-op; the dirty flag returns to `false`. Intentional — prevents the user from triggering identical refetches.
- **Mandatory + nested gating is recursive.** A nested multifilter with a mandatory field that's empty disables the root Buscar button. Visible at the call site as `snapshot.isValid === false`.
- **Nested multifilter `performButton: true` is local-only.** It confirms the nested snapshot (resetting that section's dirty state) but does **not** trigger the root's `onPerform`. The root multifilter still owns the "fire the API call" button.
- **`searchField` is a deprecated alias.** Internally treated as a virtual prominent + pinned text field. Prefer `prominent: true, pinned: true` in `fields` for new code — same snapshot shape, same behaviour, one mental model.

### State

- **Slices are dropped on unmount unless `persist={true}`.** If you mount and unmount a component repeatedly within a single screen and want to keep state, set `persist`. If you want to drop a child's state when the parent re-mounts, leave `persist` off.
- **`drop(fullId)` is prefix-based.** Dropping `userTable-table` also drops `userTable-table.mainFilter-multifilter` and every descendant. This is intentional and load-bearing for the namespace tree — but it means if you store unrelated data under a key that happens to share a prefix, it'll get nuked. Don't.
- **`clearWhen` runs on every render.** Keep the predicate cheap and stable (don't allocate large objects inside it). The function receives the current snapshot; the slice is dropped and re-initialized when it returns `true`.

### Theming

- **All colours come from shadcn semantic tokens.** Components rely on `--background`, `--foreground`, `--border`, `--muted`, `--card`, `--primary`, `--destructive`, etc. If your project doesn't define these (i.e. it isn't shadcn-themed), components will render with no styling.
- **`.dark` mode is automatic** if your project applies the `.dark` class on a parent. EasyVision uses no hardcoded colors.

---

## Escape hatch: direct registry access

The store is exported in case you need to read or mutate state outside of a component (e.g. clearing all filters on logout):

```ts
import { easyVisionRegistry } from '@/components/easyvision';

// Read all slices.
const slices = easyVisionRegistry.getState().slices;

// Drop one slice (and every descendant — prefix-based).
easyVisionRegistry.getState().drop('alerts-table');

// Clear everything.
easyVisionRegistry.getState().reset();
```

The `getSlice<K>(fullId)` helper returns a typed slice for direct reads:

```ts
import { getSlice } from '@/components/easyvision';

const tableSlice = getSlice<'table'>('alerts-table');
console.log(tableSlice?.page, tableSlice?.sort);
```
