import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { useEasyVisionSlice } from '../store/useEasyVisionSlice';
import { useDebouncedValue } from '../lib/debounce';
import type { EasyVisionInputProps } from '../types/input.types';
import type { InputSliceData } from '../store/slice-types';

export function EasyVisionInput({
  id,
  label,
  placeholder,
  debounceMs = 300,
  mandatory = false,
  defaultValue = '',
  onChange,
  onStateChange,
  icon = 'none',
  showClearButton = false,
  className,
  disabled = false,
  persist = false,
  clearWhen,
}: EasyVisionInputProps) {
  const { slice, patch } = useEasyVisionSlice<'input'>('input', id, {
    init: () => ({ kind: 'input', value: defaultValue }),
    persist,
    clearWhen: clearWhen
      ? (s: InputSliceData) => clearWhen(s.value)
      : undefined,
    onStateChange: onStateChange
      ? (s: InputSliceData) => onStateChange(s.value)
      : undefined,
  });

  const debounced = useDebouncedValue(slice.value, debounceMs);
  const lastEmittedRef = useRef<string>(slice.value);

  useEffect(() => {
    if (debounced !== lastEmittedRef.current) {
      lastEmittedRef.current = debounced;
      onChange?.(debounced);
    }
  }, [debounced, onChange]);

  const isInvalid = mandatory && slice.value.trim().length === 0;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {label && (
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {mandatory && <span className="ml-0.5 text-destructive">*</span>}
        </span>
      )}
      <div className="relative">
        {icon === 'search' && (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        )}
        <Input
          className={`h-9 ${icon === 'search' ? 'pl-9' : ''} ${showClearButton && slice.value ? 'pr-9' : ''} ${isInvalid ? 'border-destructive focus-visible:ring-destructive/40' : ''}`}
          placeholder={placeholder}
          value={slice.value}
          onChange={(e) => patch({ value: e.target.value })}
          disabled={disabled}
        />
        {showClearButton && slice.value && !disabled && (
          <button
            type="button"
            onClick={() => patch({ value: '' })}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
