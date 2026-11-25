/**
 * Saved filters: the queries a person keeps by name on one multifilter. One
 * click brings one back, one of them (the default) is applied on its own when
 * the multifilter opens clean.
 *
 * Personal, so localStorage, under a key the host picks (per table AND per
 * account if two people may share a browser). The stored shape is the one
 * nml-vision v3's data-table writes, `{ items: [{ name, filters, search }],
 * defaultName }`, with filters keyed by field id: a host that keeps v3's key
 * and field ids reads what people already saved there. Dates are stored as
 * local `YYYY-MM-DD` days, like v3. `search` holds the search terms when the
 * host names the text field they belong to (`searchFieldId`); otherwise every
 * text field travels in `filters` and `search` is written empty.
 */
import { useCallback, useState } from 'react';
import type { DateRangeValue, FieldDef } from '../types/multifilter.types';
import { isNonEmpty } from './hooks/useDirtyTracking';

export interface SavedFilter {
  name: string;
  filters: Record<string, unknown>;
  search: string[];
}

export interface SavedFiltersStore {
  items: SavedFilter[];
  defaultName: string | null;
}

export interface SavedFiltersOptions {
  /** localStorage key. Make it unique per table and per account. */
  storageKey: string;
  /**
   * Open with the default saved query when the multifilter starts clean.
   * Default `true`. A host whose page arrived with its own filters (a shared
   * link) says `false`: what the link asks for wins.
   */
  openWithDefault?: boolean;
  /**
   * The text field that holds the search terms. v3 keeps them apart, in
   * `search`; naming the field writes it there and reads it back.
   */
  searchFieldId?: string;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const EMPTY: SavedFiltersStore = { items: [], defaultName: null };

const isSavedFilter = (v: unknown): v is SavedFilter =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as SavedFilter).name === 'string' &&
  typeof (v as SavedFilter).filters === 'object' &&
  (v as SavedFilter).filters !== null;

/** Anything unreadable reads as nothing saved: a bad entry must not break the page. */
export function readSaved(storage: KeyValueStorage | undefined, key: string): SavedFiltersStore {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SavedFiltersStore>;
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .filter(isSavedFilter)
      .map((item) => ({ ...item, search: Array.isArray(item.search) ? item.search : [] }));
    const defaultName =
      typeof parsed.defaultName === 'string' && items.some((i) => i.name === parsed.defaultName)
        ? parsed.defaultName
        : null;
    return { items, defaultName };
  } catch {
    return EMPTY;
  }
}

export function writeSaved(
  storage: KeyValueStorage | undefined,
  key: string,
  store: SavedFiltersStore
): void {
  try {
    storage?.setItem(key, JSON.stringify(store));
  } catch {
    // Quota or a blocked storage: the list lives on for this visit only.
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** A local calendar day, as v3 keeps it. */
function toDay(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD` day (or any date string). */
function fromDay(value: unknown): Date | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Fields whose value can be saved: top-level ones; nested multifilters keep their own state. */
const savable = (fields: FieldDef[]) =>
  new Map(fields.filter((f) => f.type !== 'multifilter').map((f) => [f.id, f]));

/** The applied values as they are stored: empty ones dropped, dates as days. */
export function toStored(
  values: Record<string, unknown>,
  fields: FieldDef[]
): Record<string, unknown> {
  const defs = savable(fields);
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(values)) {
    const def = defs.get(id);
    if (!def || !isNonEmpty(value)) continue;
    if (def.type === 'dateRange') {
      const range = value as { from?: unknown; to?: unknown };
      const stored: Record<string, string> = {};
      const from = toDay(range.from);
      const to = toDay(range.to);
      if (from) stored.from = from;
      if (to) stored.to = to;
      if (Object.keys(stored).length > 0) out[id] = stored;
    } else {
      out[id] = value;
    }
  }
  return out;
}

/** Stored filters back as values: unknown field ids dropped, days back to Dates. */
export function fromStored(
  filters: Record<string, unknown>,
  fields: FieldDef[]
): Record<string, unknown> {
  const defs = savable(fields);
  const out: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(filters)) {
    const def = defs.get(id);
    if (!def) continue;
    if (def.type === 'dateRange') {
      const range = (value ?? {}) as { from?: unknown; to?: unknown };
      const restored: DateRangeValue = {};
      const from = fromDay(range.from);
      const to = fromDay(range.to);
      if (from) restored.from = from;
      if (to) restored.to = to;
      if (restored.from || restored.to) out[id] = restored;
    } else if (def.type === 'multiselect' && typeof value === 'string') {
      out[id] = [value]; // v3 may keep a single choice as a plain string
    } else {
      out[id] = value;
    }
  }
  return out;
}

/** The saved list of one multifilter, kept in sync with storage. Inert without a key. */
export function useSavedFilters(storageKey: string | undefined) {
  const storage = typeof window === 'undefined' ? undefined : window.localStorage;
  const [store, setStore] = useState<SavedFiltersStore>(() =>
    storageKey ? readSaved(storage, storageKey) : EMPTY
  );

  const update = useCallback(
    (next: SavedFiltersStore) => {
      setStore(next);
      if (storageKey) writeSaved(storage, storageKey, next);
    },
    [storage, storageKey]
  );

  const save = useCallback(
    (name: string, filters: Record<string, unknown>, search: string[] = []) => {
      const saved: SavedFilter = { name, filters, search };
      // A repeated name replaces in place: the list keeps its order.
      const known = store.items.some((i) => i.name === name);
      const items = known
        ? store.items.map((i) => (i.name === name ? saved : i))
        : [...store.items, saved];
      update({ ...store, items });
    },
    [store, update]
  );

  const remove = useCallback(
    (name: string) =>
      update({
        items: store.items.filter((i) => i.name !== name),
        defaultName: store.defaultName === name ? null : store.defaultName,
      }),
    [store, update]
  );

  const setDefault = useCallback(
    (name: string | null) => update({ ...store, defaultName: name }),
    [store, update]
  );

  return {
    items: store.items,
    defaultName: store.defaultName,
    defaultFilter: store.items.find((i) => i.name === store.defaultName),
    save,
    remove,
    setDefault,
  };
}
