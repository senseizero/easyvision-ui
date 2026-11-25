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
  value: controlledValue,
  inputProps,
}: EasyVisionInputProps) {
  const controlled = controlledValue !== undefined;
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

  const current = controlled ? controlledValue : slice.value;
  const debounced = useDebouncedValue(slice.value, debounceMs);
  const lastEmittedRef = useRef<string>(slice.value);

  useEffect(() => {
    // Controlled: every keystroke was already reported, undebounced.
    if (controlled) return;
    if (debounced !== lastEmittedRef.current) {
      lastEmittedRef.current = debounced;
      onChange?.(debounced);
    }
  }, [debounced, onChange, controlled]);

  const set = (next: string) => {
    if (controlled) onChange?.(next);
    else patch({ value: next });
  };

  const isInvalid = mandatory && current.trim().length === 0;

  const hasIcon = icon === 'search';
  const hasClear = Boolean(showClearButton && current && !disabled);

  return (
    <div
      className={[
        'ev-input-comp',
        hasIcon ? 'has-icon' : '',
        hasClear ? 'has-clear' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {label && (
        <span className="ev-input-comp-label">
          {label}
          {mandatory && <span className="ev-input-comp-required">*</span>}
        </span>
      )}
      <div className="ev-input-comp-wrap">
        {hasIcon && <Search className="ev-input-comp-icon" />}
        <Input
          {...inputProps}
          className={[isInvalid ? 'is-invalid' : '', inputProps?.className ?? '']
            .filter(Boolean)
            .join(' ') || undefined}
          placeholder={placeholder}
          value={current}
          onChange={(e) => set(e.target.value)}
          disabled={disabled}
        />
        {hasClear && (
          <button
            type="button"
            onClick={() => set('')}
            className="ev-input-comp-clear"
          >
            <X />
          </button>
        )}
      </div>
    </div>
  );
}
