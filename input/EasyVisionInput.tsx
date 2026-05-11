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

  const hasIcon = icon === 'search';
  const hasClear = Boolean(showClearButton && slice.value && !disabled);

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
          className={isInvalid ? 'is-invalid' : undefined}
          placeholder={placeholder}
          value={slice.value}
          onChange={(e) => patch({ value: e.target.value })}
          disabled={disabled}
        />
        {hasClear && (
          <button
            type="button"
            onClick={() => patch({ value: '' })}
            className="ev-input-comp-clear"
          >
            <X />
          </button>
        )}
      </div>
    </div>
  );
}
