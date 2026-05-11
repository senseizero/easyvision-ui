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
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import type { EasyVisionSelectorProps } from '../types/selector.types';
import type { SelectorOption } from '../types/common.types';
import type { SelectorSliceData } from '../store/slice-types';

const SENTINEL_UNDEFINED = '__easyvision_undef__';

export function EasyVisionSelector<V extends string | number = string | number>({
  id,
  label,
  options,
  placeholder = 'Seleccionar...',
  mandatory = false,
  defaultValue,
  confirmMode = false,
  confirmLabel = 'Confirmar',
  searchable = false,
  onChange,
  onStateChange,
  className,
  disabled = false,
  persist = false,
  clearWhen,
}: EasyVisionSelectorProps<V>) {
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

  const value = slice.value as V | undefined;

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
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      onChange?.(value);
    }
  }, [value, onChange]);

  const isInvalid = mandatory && (value === undefined || value === '');

  const commit = (v: V | undefined) => patch({ value: v });

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
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={['ev-selector-combo-trigger', triggerExtraClasses].filter(Boolean).join(' ')}
            >
              {value !== undefined && value !== '' ? labelOf(value) : <span className="ev-selector-combo-placeholder">{placeholder}</span>}
              <ChevronsUpDown className="ev-selector-combo-icon" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="ev-selector-combo-popover" align="start">
            <Command>
              <CommandInput placeholder="Buscar..." />
              <CommandList>
                <CommandEmpty>Sin resultados</CommandEmpty>
                <CommandGroup>
                  {opts.map((o) => (
                    <CommandItem
                      key={String(o.value)}
                      value={o.label}
                      onSelect={() => commit(o.value)}
                    >
                      <Check className={['ev-selector-item-check', value === o.value ? '' : 'is-hidden'].filter(Boolean).join(' ')} />
                      {o.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Non-searchable: shadcn Select.
  const selectValue =
    value === undefined || value === ''
      ? SENTINEL_UNDEFINED
      : String(value);

  const onValueChange = (raw: string) => {
    if (raw === SENTINEL_UNDEFINED) {
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
        <Select value={selectValue} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger className={triggerExtraClasses || undefined}>
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
            aria-label="Limpiar"
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
