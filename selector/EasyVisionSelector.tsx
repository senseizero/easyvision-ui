import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { ChevronsUpDown, X } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '../ui/combobox';
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import type { EasyVisionSelectorProps } from '../types/selector.types';
import type { SelectorOption } from '../types/common.types';
import type { SelectorSliceData } from '../store/slice-types';

export function EasyVisionSelector<V extends string | number = string | number>({
  id,
  label,
  options,
  placeholder = 'Seleccionar...',
  mandatory = false,
  defaultValue,
  confirmMode = false,
  confirmLabel = 'Confirmar',
  clearLabel = 'Limpiar',
  searchPlaceholder = 'Buscar...',
  noResultsLabel = 'Sin resultados',
  searchable = false,
  onChange,
  onStateChange,
  className,
  disabled = false,
  persist = false,
  clearWhen,
  value: controlledValue,
  triggerProps,
}: EasyVisionSelectorProps<V>) {
  const controlled = controlledValue !== undefined;
  const { slice, patch } = useEasyVisionSlice<'selector'>('selector', id, {
    init: () => ({ kind: 'selector', value: defaultValue }),
    persist,
    clearWhen: clearWhen
      ? (s: SelectorSliceData) => clearWhen(s.value as V | undefined)
      : undefined,
    onStateChange: onStateChange
      ? (s: SelectorSliceData) => onStateChange(s.value as V | undefined)
      : undefined,
  });

  const value = (controlled ? controlledValue ?? undefined : slice.value) as V | undefined;

  const [resolved, setResolved] = useState<SelectorOption<V>[] | null>(
    Array.isArray(options) ? options : null
  );
  useEffect(() => {
    if (typeof options === 'function' && resolved === null) {
      void (options as () => Promise<SelectorOption<V>[]>)().then(setResolved).catch(() => setResolved([]));
    } else if (Array.isArray(options)) {
      setResolved(options);
    }
  }, [options, resolved]);

  const opts: SelectorOption<V>[] = resolved ?? [];

  // Confirm mode: stage a pending value that's only committed on Confirm.
  const [pending, setPending] = useState<V | undefined>(value);
  useEffect(() => setPending(value), [value]);

  const lastEmittedRef = useRef<V | undefined>(value);
  useEffect(() => {
    // Controlled: the pick was reported by `commit`.
    if (controlled) return;
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      onChange?.(value);
    }
  }, [value, onChange, controlled]);

  const isInvalid = mandatory && (value === undefined || value === '');

  const commit = (v: V | undefined) => {
    if (controlled) onChange?.(v);
    else patch({ value: v });
  };

  const triggerExtraClasses = [
    isInvalid ? 'ev-selector-trigger-invalid' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  if (searchable) {
    const labelOf = (v: V | undefined) =>
      opts.find((o) => o.value === v)?.label ?? '';
    return (
      <div className="ev-selector">
        {label && (
          <span className="ev-selector-label">
            {label}
            {mandatory && <span className="ev-selector-required">*</span>}
          </span>
        )}
        <Combobox<SelectorOption<V>>
          items={opts}
          value={opts.find((o) => o.value === value) ?? null}
          onValueChange={(o) => commit(o?.value)}
          itemToStringLabel={(o) => o.label}
          isItemEqualToValue={(a, b) => a.value === b.value}
          disabled={disabled}
        >
          <ComboboxTrigger
            render={
              <Button
                {...triggerProps}
                variant="outline"
                className={['ev-selector-combo-trigger', triggerExtraClasses].filter(Boolean).join(' ')}
              />
            }
          >
            {value !== undefined && value !== '' ? labelOf(value) : <span className="ev-selector-combo-placeholder">{placeholder}</span>}
            <ChevronsUpDown className="ev-selector-combo-icon" />
          </ComboboxTrigger>
          <ComboboxContent className="ev-selector-combo-popover">
            <ComboboxInput placeholder={searchPlaceholder} />
            <ComboboxEmpty>{noResultsLabel}</ComboboxEmpty>
            <ComboboxList>
              {(o: SelectorOption<V>) => (
                <ComboboxItem key={String(o.value)} value={o}>
                  {o.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    );
  }

  // Non-searchable: shadcn Select (Base UI). Nothing picked is `null`, which
  // shows the placeholder; `items` lets the trigger show the label, not the value.
  const selectValue = value === undefined || value === '' ? null : String(value);
  const selectItems = opts.map((o) => ({ value: String(o.value), label: o.label }));

  const onValueChange = (raw: string | null) => {
    if (raw === null || raw === '') {
      if (confirmMode) setPending(undefined);
      else commit(undefined);
      return;
    }
    const matched = opts.find((o) => String(o.value) === raw);
    const next = matched?.value;
    if (confirmMode) setPending(next);
    else commit(next);
  };

  return (
    <div className="ev-selector">
      {label && (
        <span className="ev-selector-label">
          {label}
          {mandatory && <span className="ev-selector-required">*</span>}
        </span>
      )}
      <div className="ev-selector-row">
        <Select value={selectValue} onValueChange={onValueChange} disabled={disabled} items={selectItems}>
          <SelectTrigger {...triggerProps} className={triggerExtraClasses || undefined}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => (
              <SelectItem key={String(o.value)} value={String(o.value)}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!mandatory && value !== undefined && value !== '' && !disabled && (
          <button
            type="button"
            onClick={() => (confirmMode ? setPending(undefined) : commit(undefined))}
            className="ev-selector-clear"
            aria-label={clearLabel}
          >
            <X />
          </button>
        )}
        {confirmMode && pending !== value && (
          <Button size="sm" onClick={() => commit(pending)}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
