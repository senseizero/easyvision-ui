import * as React from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import { Input } from '../ui/input';
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import { NamespaceProvider } from '../store/NamespaceContext';
import { easyVisionRegistry } from '../store/registry';
import type {
  EasyVisionMultifilterProps,
  FieldDef,
  MultifilterFieldDef,
  MultifilterHandle,
  MultifilterLabels,
  MultifilterQuery,
  MultifilterSnapshot,
  TextFieldDef,
} from '../types/multifilter.types';
import type { MultifilterSliceData } from '../store/slice-types';
import { MultifilterField } from './MultifilterField';
import { useBuildQuery } from './hooks/useMultifilterQuery';
import { buildSnapshotKey, isDirty as computeIsDirty, isNonEmpty } from './hooks/useDirtyTracking';

const DEFAULT_LABELS: MultifilterLabels = {
  search: 'Buscar',
  clear: 'Limpiar',
  perform: 'Buscar',
  addFilter: 'Añadir filtro',
  noOptions: 'Sin opciones',
  searchPlaceholder: 'Buscar...',
};

export type { MultifilterHandle } from '../types/multifilter.types';

function isFieldVisible(
  def: FieldDef,
  values: Record<string, unknown>
): boolean {
  if (def.visible === undefined) return true;
  if (typeof def.visible === 'boolean') return def.visible;
  return def.visible(values);
}

function isMandatorySatisfied(def: FieldDef, value: unknown): boolean {
  if (!def.mandatory) return true;
  return isNonEmpty(value);
}

export const EasyVisionMultifilter = forwardRef<
  MultifilterHandle,
  EasyVisionMultifilterProps
>(function EasyVisionMultifilter(props, ref) {
  const {
    id,
    config,
    editable = true,
    performButton = false,
    performLabel,
    performIcon,
    performPosition = 'inline',
    performTargetRef,
    performOnMount = false,
    performMode = 'auto',
    performDebounceMs = 0,
    onPerform,
    onChange,
    onStateChange,
    showClearAll,
    labels: labelOverrides,
    className,
    persist = false,
    clearWhen,
  } = props;

  // When `performMode === 'auto'` and we're rendered standalone (no parent
  // table override), fall back to manual — safer for unknown consumers and
  // matches the historical default.
  const resolvedPerformMode: 'live' | 'manual' =
    performMode === 'live' ? 'live' : 'manual';

  const labels: MultifilterLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const showClear = showClearAll ?? editable;

  // Compute initial active fields: pinned + initiallyActive + searchField (always shown).
  const initialActive = useMemo(() => {
    const ids: string[] = [];
    if (config.searchField) ids.push(config.searchField.id);
    for (const f of config.fields) {
      if (f.pinned || f.initiallyActive) ids.push(f.id);
    }
    return ids;
  }, [config]);

  const initialValues = useMemo(() => {
    const v: Record<string, unknown> = {};
    if (config.searchField?.defaultValue !== undefined) {
      v[config.searchField.id] = config.searchField.defaultValue;
    }
    for (const f of config.fields) {
      if (f.defaultValue !== undefined) v[f.id] = f.defaultValue;
    }
    return v;
  }, [config]);

  const { slice, fullId, patch } = useEasyVisionSlice<'multifilter'>('multifilter', id, {
    init: () => ({
      kind: 'multifilter',
      activeFields: initialActive,
      values: initialValues,
      lastConfirmedSnapshotJSON: null,
    }),
    persist,
    clearWhen: clearWhen
      ? (s) =>
          clearWhen({
            values: s.values,
            activeFields: s.activeFields,
            isValid: false,
            isDirty: false,
            query: {},
          })
      : undefined,
  });

  const { activeFields, values, lastConfirmedSnapshotJSON } = slice;

  // Track child multifilter slices via React-aware external store subscription.
  // The previous `setChildTick`-in-subscribe pattern dispatched React state
  // updates from inside zustand's synchronous notify pass, which could cascade
  // into "setState during render" warnings when several multifilter instances
  // reacted to one another's `patch` call. `useSyncExternalStore` integrates
  // with the React scheduler and avoids that.
  const registryState = useSyncExternalStore(
    easyVisionRegistry.subscribe,
    easyVisionRegistry.getState,
    easyVisionRegistry.getState,
  );

  const childSnapshots = useMemo(() => {
    const out: Record<string, { values: Record<string, unknown>; activeFields: string[] }> = {};
    for (const f of config.fields) {
      if (f.type !== 'multifilter') continue;
      const childFullId = `${fullId}.${f.id}-multifilter`;
      const childSlice = registryState.slices[childFullId] as
        | MultifilterSliceData
        | undefined;
      if (childSlice) {
        out[f.id] = {
          values: childSlice.values,
          activeFields: childSlice.activeFields,
        };
      }
    }
    return out;
  }, [fullId, config.fields, registryState]);

  const childQueries = useMemo(() => {
    const out: Record<string, MultifilterQuery> = {};
    for (const f of config.fields) {
      if (f.type !== 'multifilter') continue;
      const childSnap = childSnapshots[f.id];
      if (!childSnap) continue;
      // Build child where on the fly (lightweight; nested fields share the
      // same buildCondition logic via useBuildQuery — we re-run it here).
      out[f.id] = buildChildQueryDirect(f as MultifilterFieldDef, childSnap.values);
    }
    return out;
  }, [config.fields, childSnapshots]);

  const buildQuery = useBuildQuery(config, values, childQueries);

  // Compose values including nested multifilter snapshots.
  const composedValues = useMemo(() => {
    const out: Record<string, unknown> = { ...values };
    for (const f of config.fields) {
      if (f.type === 'multifilter') {
        out[f.id] = childSnapshots[f.id]?.values ?? {};
      }
    }
    return out;
  }, [values, config.fields, childSnapshots]);

  // Validity: every mandatory (own + nested) has non-empty value.
  const isValid = useMemo(() => {
    if (config.searchField && !isMandatorySatisfied(config.searchField, values[config.searchField.id])) {
      return false;
    }
    for (const f of config.fields) {
      if (f.type === 'multifilter') {
        // Nested mandatory fields propagate.
        const childSnap = childSnapshots[f.id];
        if (!childSnap) {
          // Child not mounted yet — assume valid until it mounts.
          continue;
        }
        for (const cf of f.config.fields) {
          if (cf.mandatory && !isMandatorySatisfied(cf, childSnap.values[cf.id])) return false;
        }
        if (
          f.config.searchField?.mandatory &&
          !isMandatorySatisfied(f.config.searchField, childSnap.values[f.config.searchField.id])
        ) {
          return false;
        }
      } else if (!isMandatorySatisfied(f, values[f.id])) {
        return false;
      }
    }
    return true;
  }, [config, values, childSnapshots]);

  // Snapshot composition for dirty tracking — uses composedValues so nested filters affect dirtiness.
  const snapshotKey = useMemo(
    () => buildSnapshotKey({ activeFields, values: composedValues }),
    [activeFields, composedValues]
  );

  const dirty = useMemo(
    () => computeIsDirty({ activeFields, values: composedValues }, lastConfirmedSnapshotJSON),
    [activeFields, composedValues, lastConfirmedSnapshotJSON]
  );

  const snapshot: MultifilterSnapshot = useMemo(
    () => ({
      values: composedValues,
      activeFields,
      isValid,
      isDirty: dirty,
      query: buildQuery(),
    }),
    [composedValues, activeFields, isValid, dirty, buildQuery]
  );

  // onChange + onStateChange: emit on every snapshot change.
  const lastEmittedKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${snapshotKey}|${dirty}|${isValid}`;
    if (key === lastEmittedKeyRef.current) return;
    lastEmittedKeyRef.current = key;
    onChange?.(snapshot);
    onStateChange?.(snapshot);
  }, [snapshotKey, dirty, isValid, snapshot, onChange, onStateChange]);

  // Perform action.
  //
  // `patch` is applied synchronously so internal state (the confirmed snapshot
  // key) is correct immediately. The external `onPerform` callback is deferred
  // to the next microtask, which prevents downstream `setState` calls from
  // landing inside the current commit phase — the original cause of React's
  // "Cannot update a component while rendering a different component" warning
  // when this is invoked from `useEffect` (e.g. `performOnMount`) or from the
  // live-mode auto-fire effect below.
  const performAction = useCallback(() => {
    const key = buildSnapshotKey({ activeFields, values: composedValues });
    patch({ lastConfirmedSnapshotJSON: key });
    if (onPerform) {
      const emitted: MultifilterSnapshot = { ...snapshot, isDirty: false };
      queueMicrotask(() => onPerform(emitted));
    }
  }, [activeFields, composedValues, patch, onPerform, snapshot]);

  // performOnMount: fire once on mount if there's anything to perform.
  // Both fresh seeds (`defaultValue`s) and persisted state (restored values
  // from a previous session) should re-emit on remount, so listeners — chiefly
  // a bound EasyVisionTable — receive the active `where` clause for their
  // first fetch. Without this, navigating away from a filtered table and back
  // would issue a fetch with no filter.
  const didPerformOnMountRef = useRef(false);
  useEffect(() => {
    if (
      performOnMount &&
      !didPerformOnMountRef.current &&
      Object.values(composedValues).some(isNonEmpty)
    ) {
      didPerformOnMountRef.current = true;
      performAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [performOnMount]);

  // Live mode: auto-fire `performAction` whenever the snapshot's value/active
  // composition changes. Debounced via `performDebounceMs` so rapid edits
  // (typing into a text field, toggling several chips quickly) collapse into a
  // single perform.
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livePrevKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedPerformMode !== 'live') return;
    // Establish baseline on first mount without firing — initial seeds are the
    // responsibility of `performOnMount`. After that, every distinct change to
    // the snapshot key triggers a debounced perform.
    if (livePrevKeyRef.current === null) {
      livePrevKeyRef.current = snapshotKey;
      return;
    }
    if (livePrevKeyRef.current === snapshotKey) return;
    livePrevKeyRef.current = snapshotKey;

    if (liveTimerRef.current !== null) clearTimeout(liveTimerRef.current);
    liveTimerRef.current = setTimeout(() => {
      liveTimerRef.current = null;
      performAction();
    }, performDebounceMs);

    return () => {
      if (liveTimerRef.current !== null) {
        clearTimeout(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, [snapshotKey, resolvedPerformMode, performDebounceMs, performAction]);

  useImperativeHandle(ref, () => ({
    perform: performAction,
    getSnapshot: () => snapshot,
  }));

  // Add / remove field actions.
  const updateValue = useCallback(
    (fieldId: string, value: unknown) => {
      patch({ values: { ...values, [fieldId]: value } });
    },
    [patch, values]
  );

  const addField = useCallback(
    (fieldId: string) => {
      if (activeFields.includes(fieldId)) return;
      patch({ activeFields: [...activeFields, fieldId] });
    },
    [activeFields, patch]
  );

  const removeField = useCallback(
    (fieldId: string) => {
      const nextValues = { ...values };
      delete nextValues[fieldId];
      patch({
        activeFields: activeFields.filter((f) => f !== fieldId),
        values: nextValues,
      });
    },
    [activeFields, values, patch]
  );

  const clearAll = useCallback(() => {
    const seed: Record<string, unknown> = {};
    if (config.searchField?.defaultValue !== undefined) {
      seed[config.searchField.id] = config.searchField.defaultValue;
    }
    patch({
      values: seed,
      activeFields: initialActive.filter((id) => {
        const def = config.fields.find((f) => f.id === id);
        return def?.pinned;
      }).concat(config.searchField ? [config.searchField.id] : []),
      lastConfirmedSnapshotJSON: null,
    });
  }, [config, patch, initialActive]);

  // Partition fields into pinned vs chip area, filtered by visibility.
  const visibleConfigFields = useMemo(
    () => config.fields.filter((f) => isFieldVisible(f, composedValues)),
    [config.fields, composedValues]
  );

  // A field is "prominent" if it's an opt-in text field configured to render
  // as a full-width search bar. The legacy `config.searchField` slot is
  // treated as a virtual prominent + pinned text field.
  const isProminentTextField = (f: FieldDef): f is TextFieldDef =>
    f.type === 'text' && (f as TextFieldDef).prominent === true;

  const pinnedFields = useMemo(
    () => visibleConfigFields.filter((f) => f.pinned && !isProminentTextField(f)),
    [visibleConfigFields]
  );

  const chipFields = useMemo(
    () =>
      visibleConfigFields.filter(
        (f) => !f.pinned && !isProminentTextField(f) && activeFields.includes(f.id)
      ),
    [visibleConfigFields, activeFields]
  );

  const prominentSlots = useMemo(() => {
    const slots: Array<{
      def: TextFieldDef;
      removable: boolean;
      isLegacySearchField: boolean;
    }> = [];
    if (config.searchField) {
      slots.push({
        def: config.searchField,
        removable: false, // legacy slot is implicitly always-present
        isLegacySearchField: true,
      });
    }
    for (const f of visibleConfigFields) {
      if (!isProminentTextField(f)) continue;
      if (!activeFields.includes(f.id)) continue;
      slots.push({
        def: f,
        removable: editable !== false && !f.pinned && !f.locked,
        isLegacySearchField: false,
      });
    }
    return slots;
  }, [config.searchField, visibleConfigFields, activeFields, editable]);

  const availableToAdd = useMemo(
    () =>
      visibleConfigFields.filter(
        (f) => !f.pinned && !activeFields.includes(f.id)
      ),
    [visibleConfigFields, activeFields]
  );

  const performEnabled = editable !== false && performButton && isValid && dirty;
  const performLabelText = performLabel ?? labels.perform;

  const renderField = (f: FieldDef) => {
    if (f.type === 'multifilter') {
      const removable = editable && !f.pinned && !f.locked;
      return (
        <div key={f.id} className="ev-mf-nested">
          <div className="ev-mf-nested-header">
            <span className="ev-mf-nested-label">{f.label}</span>
            {removable && (
              <button
                type="button"
                onClick={() => removeField(f.id)}
                className="ev-mf-nested-remove"
              >
                <X />
              </button>
            )}
          </div>
          <EasyVisionMultifilter
            id={f.id}
            config={f.config}
            editable={editable}
            performButton={false}
            labels={labelOverrides}
          />
        </div>
      );
    }
    const removable = editable && !f.pinned && !f.locked;
    return (
      <MultifilterField
        key={f.id}
        definition={f}
        value={values[f.id]}
        onChange={(v) => updateValue(f.id, v)}
        onRemove={removable ? () => removeField(f.id) : undefined}
      />
    );
  };

  return (
    <NamespaceProvider fullId={fullId}>
      <div className={className}>
        <div className="ev-mf-panel">
          {/* Row 1: prominent search bars + add + perform + clear */}
          <div className="ev-mf-row">
            {prominentSlots.map(({ def, removable, isLegacySearchField }) => (
              <div
                key={isLegacySearchField ? `__searchField__${def.id}` : def.id}
                className="ev-mf-search-slot"
              >
                <Search className="ev-mf-search-icon" />
                <input
                  className={['ev-mf-search-input', removable ? 'has-clear' : 'no-clear']
                    .filter(Boolean)
                    .join(' ')}
                  placeholder={def.placeholder ?? def.label ?? labels.searchPlaceholder}
                  value={(values[def.id] as string | undefined) ?? ''}
                  onChange={(e) => updateValue(def.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && performButton && performEnabled) {
                      performAction();
                    }
                  }}
                />
                {removable && (
                  <button
                    type="button"
                    onClick={() => removeField(def.id)}
                    aria-label={labels.clear}
                    className="ev-mf-search-clear"
                  >
                    <X />
                  </button>
                )}
              </div>
            ))}

            {editable && availableToAdd.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ev-mf-add-btn"
                    aria-label={labels.addFilter}
                  >
                    <Plus />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="ev-mf-add-popover" align="start">
                  <div className="ev-mf-add-list">
                    {availableToAdd.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => addField(f.id)}
                        className="ev-mf-add-item"
                      >
                        <Plus />
                        {f.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {performButton && performPosition === 'inline' && (
              <Button
                size="sm"
                onClick={performAction}
                disabled={!performEnabled}
                className="ev-mf-perform"
              >
                {performIcon ?? <Search />}
                {performLabelText}
              </Button>
            )}

            {showClear && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="ev-mf-clear"
              >
                <X />
                {labels.clear}
              </Button>
            )}
          </div>

          {/* Pinned area */}
          {pinnedFields.length > 0 && (
            <div className="ev-mf-row">{pinnedFields.map(renderField)}</div>
          )}

          {/* Chip area */}
          {chipFields.length > 0 && (
            <div className="ev-mf-row">{chipFields.map(renderField)}</div>
          )}

          {performButton && performPosition === 'belowRow' && (
            <div className="ev-mf-below-row">
              <Button
                size="sm"
                onClick={performAction}
                disabled={!performEnabled}
                className="ev-mf-perform"
              >
                {performIcon ?? <Search />}
                {performLabelText}
              </Button>
            </div>
          )}
        </div>
      </div>
    </NamespaceProvider>
  );
});

// Light-weight standalone version of buildCondition used for nested children
// query merging without re-running the full hook.
function buildChildQueryDirect(
  field: MultifilterFieldDef,
  values: Record<string, unknown>
): MultifilterQuery {
  const where: Record<string, unknown> = {};
  for (const def of field.config.fields) {
    if (def.type === 'multifilter') continue;
    const v = values[def.id];
    if (v === undefined || v === null || v === '') continue;
    if (!def.field) continue;
    switch (def.type) {
      case 'text': {
        const str = String(v).trim();
        if (str) where[def.field] = { $regex: `.*${str}.*`, $options: 'i' };
        break;
      }
      case 'selector':
        where[def.field] = v;
        break;
      case 'multiselect': {
        const arr = v as (string | number)[];
        if (Array.isArray(arr) && arr.length > 0) where[def.field] = { $in: arr };
        break;
      }
      case 'dateRange': {
        const r = v as { from?: Date; to?: Date };
        if (r?.from || r?.to) {
          const cond: Record<string, string> = {};
          if (r.from) cond.$gte = r.from.toISOString();
          if (r.to) cond.$lte = r.to.toISOString();
          where[def.field] = cond;
        }
        break;
      }
      case 'numberRange': {
        const r = v as { min?: number; max?: number };
        if (r?.min != null || r?.max != null) {
          const cond: Record<string, number> = {};
          if (r.min != null) cond.$gte = r.min;
          if (r.max != null) cond.$lte = r.max;
          where[def.field] = cond;
        }
        break;
      }
    }
  }
  if (field.config.searchField) {
    const sv = values[field.config.searchField.id];
    if (typeof sv === 'string' && sv.trim() && field.config.searchField.field) {
      where[field.config.searchField.field] = { $regex: `.*${sv.trim()}.*`, $options: 'i' };
    }
  }
  return Object.keys(where).length > 0 ? { where } : {};
}
