import type { ComponentType, ReactNode, RefObject } from 'react';
import type { BaseStatefulProps, SelectorOption } from './common.types';

export type MultifilterFieldType =
  | 'text'
  | 'selector'
  | 'multiselect'
  | 'dateRange'
  | 'numberRange'
  | 'multifilter'
  | 'custom';

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

export interface MultifilterFieldBase {
  id: string;
  label: string;
  /** API field path — e.g. 'client.country'. Optional for purely UI fields. */
  field?: string;
  /** Always rendered, never removable. */
  pinned?: boolean;
  /** Show by default in the chip area on first mount (ignored if pinned — pinned ⇒ always active). */
  initiallyActive?: boolean;
  /** Suppress the X chip but keep the field active. */
  locked?: boolean;
  mandatory?: boolean;
  visible?: boolean | ((values: Record<string, unknown>) => boolean);
  /**
   * Map the user's value to a backend condition (a `where` fragment).
   *
   * Return shape:
   * - `undefined` / `null` → field contributes nothing to the query.
   * - An object starting with `$or` / `$and` → merged at the top level of
   *   `where` as-is (use this to search across multiple paths, e.g.
   *   `{ $or: [{ name: like }, { topics: like }] }`).
   * - Anything else → wrapped under `def.field` automatically.
   *
   * Use this for: multi-path search bars, range encoding, value mapping
   * (e.g. `'RECURRING' → true`), $in vs scalar tradeoffs, etc.
   */
  toCondition?: (value: unknown) => unknown;
  /** @deprecated Renamed to `toCondition`. Kept as an alias for back-compat. */
  transform?: (value: unknown) => unknown;
  defaultValue?: unknown;
  placeholder?: string;
}

export interface TextFieldDef extends MultifilterFieldBase {
  type: 'text';
  /**
   * Render this field as a prominent full-width search bar at the top of the
   * panel (with a magnifier icon and Enter-to-perform), instead of as an
   * inline chip. Orthogonal to `pinned`/`initiallyActive`:
   *  - `prominent + pinned` → permanent big bar (replaces the legacy `config.searchField`).
   *  - `prominent + initiallyActive` → big bar that the user can detach via X
   *    and re-add from the `+` menu.
   *  - `prominent` (alone) → starts hidden; users opt in from the `+` menu and
   *    it then appears as a big bar.
   *
   * Multiple prominent fields are supported and wrap onto extra rows as needed.
   */
  prominent?: boolean;
}

export interface SelectorFieldDef<V extends string | number = string | number>
  extends MultifilterFieldBase {
  type: 'selector';
  options: SelectorOption<V>[] | (() => Promise<SelectorOption<V>[]>);
  searchable?: boolean;
}

export interface MultiSelectFieldDef<V extends string | number = string | number>
  extends MultifilterFieldBase {
  type: 'multiselect';
  options: SelectorOption<V>[] | (() => Promise<SelectorOption<V>[]>);
}

export interface DateRangeFieldDef extends MultifilterFieldBase {
  type: 'dateRange';
}

export interface NumberRangeFieldDef extends MultifilterFieldBase {
  type: 'numberRange';
}

export interface MultifilterFieldDef extends MultifilterFieldBase {
  type: 'multifilter';
  config: MultifilterConfig;
}

export interface CustomFieldDef extends MultifilterFieldBase {
  type: 'custom';
  component: ComponentType<{
    value: unknown;
    onChange: (value: unknown) => void;
    onRemove: () => void;
    definition: MultifilterFieldBase;
  }>;
}

export type FieldDef =
  | TextFieldDef
  | SelectorFieldDef
  | MultiSelectFieldDef
  | DateRangeFieldDef
  | NumberRangeFieldDef
  | MultifilterFieldDef
  | CustomFieldDef;

export interface MultifilterConfig {
  /**
   * @deprecated Prefer adding a `TextFieldDef` to `fields` with
   * `prominent: true, pinned: true`. Kept as an alias for backward
   * compatibility — internally treated as a prominent pinned text field.
   */
  searchField?: TextFieldDef;
  fields: FieldDef[];
  defaultOrder?: string[];
  defaultLimit?: number;
}

export interface MultifilterLabels {
  search: string;
  clear: string;
  perform: string;
  addFilter: string;
  noOptions: string;
  searchPlaceholder: string;
}

export interface MultifilterQuery {
  where?: Record<string, unknown>;
  order?: string[];
  limit?: number;
}

export interface MultifilterSnapshot {
  values: Record<string, unknown>;
  activeFields: string[];
  isValid: boolean;
  isDirty: boolean;
  query: MultifilterQuery;
}

export interface MultifilterHandle {
  /** Programmatically trigger the perform action (same as pressing Buscar). */
  perform: () => void;
  /** Read the current snapshot. */
  getSnapshot: () => MultifilterSnapshot;
}

export interface EasyVisionMultifilterProps extends BaseStatefulProps<MultifilterSnapshot> {
  config: MultifilterConfig;
  /** Toggle add/remove (the "+" and X chips). When false, layout is fully static. Default true. */
  editable?: boolean;
  /** Show a Buscar button. Default false. */
  performButton?: boolean;
  performLabel?: string;
  performIcon?: ReactNode;
  performPosition?: 'inline' | 'belowRow' | 'externalRef';
  performTargetRef?: RefObject<HTMLElement>;
  /** Auto-fire onPerform once on mount (useful when restoring persisted state). */
  performOnMount?: boolean;
  /**
   * Controls when `performAction` (and therefore `onPerform`) fires in response
   * to value/field changes.
   *
   * - `'manual'` (default for standalone use): only fires from the Buscar
   *   button, `performOnMount`, or the imperative `perform()` ref. This is the
   *   right default for API-backed tables where each perform = a network
   *   request.
   * - `'live'`: also fires on every change to the active values, optionally
   *   debounced via `performDebounceMs`. Use for in-memory tables where
   *   filtering is cheap.
   * - `'auto'`: ask the parent. When the multifilter is bound through a
   *   table's `multifilter` prop, the table picks `'live'` for
   *   `paginationMode: 'local'` and `'manual'` for `paginationMode: 'api'`.
   *   Falls back to `'manual'` for standalone mounts.
   *
   * Default `'auto'`.
   */
  performMode?: 'live' | 'manual' | 'auto';
  /**
   * Debounce window in ms before a `'live'`-mode perform fires after the last
   * change. Default `0` (next-tick).
   */
  performDebounceMs?: number;
  onPerform?: (snap: MultifilterSnapshot) => void;
  onChange?: (snap: MultifilterSnapshot) => void;
  showClearAll?: boolean;
  labels?: Partial<MultifilterLabels>;
  className?: string;
}
