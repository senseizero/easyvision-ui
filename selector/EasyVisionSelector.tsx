import { useEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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

  const triggerClasses = `${isInvalid ? 'border-destructive focus-visible:ring-destructive/40' : ''} ${className ?? ''}`;

  if (searchable) {
    const labelOf = (v: V | undefined) =>
      opts.find((o) => o.value === v)?.label ?? '';
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <span className="text-xs font-medium text-muted-foreground">
            {label}
            {mandatory && <span className="ml-0.5 text-destructive">*</span>}
          </span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              disabled={disabled}
              className={`h-10 justify-between font-normal ${triggerClasses}`}
            >
              {value !== undefined && value !== '' ? labelOf(value) : <span className="text-muted-foreground">{placeholder}</span>}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
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
                      <Check className={`mr-2 h-4 w-4 ${value === o.value ? 'opacity-100' : 'opacity-0'}`} />
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
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {mandatory && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}
      <div className="flex items-center gap-2">
        <Select value={selectValue} onValueChange={onValueChange} disabled={disabled}>
          <SelectTrigger className={triggerClasses}>
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
            className="p-1 hover:bg-muted rounded"
            aria-label="Limpiar"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
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
