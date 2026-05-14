import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { X } from 'lucide-react';
import type { SelectorFieldDef } from '../../types/multifilter.types';
import type { SelectorOption } from '../../types/common.types';

const SENTINEL = '__easyvision_undef__';

export interface SelectorWidgetProps {
  definition: SelectorFieldDef;
  value: string | number | undefined;
  onChange: (value: string | number | undefined) => void;
  onRemove?: () => void;
}

export function SelectorWidget({ definition, value, onChange, onRemove }: SelectorWidgetProps) {
  const [resolved, setResolved] = useState<SelectorOption[] | null>(
    Array.isArray(definition.options) ? (definition.options as SelectorOption[]) : null
  );

  useEffect(() => {
    if (typeof definition.options === 'function' && resolved === null) {
      void (definition.options as () => Promise<SelectorOption[]>)()
        .then((o) => setResolved(o))
        .catch(() => setResolved([]));
    } else if (Array.isArray(definition.options)) {
      setResolved(definition.options as SelectorOption[]);
    }
  }, [definition.options, resolved]);

  const opts = resolved ?? [];
  const selectValue =
    value === undefined || value === '' ? SENTINEL : String(value);

  return (
    <div className="ev-mf-chip is-wrap">
      <span className="ev-mf-chip-label">
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}:
      </span>
      <Select
        value={selectValue}
        onValueChange={(raw) => {
          if (raw === SENTINEL) onChange(undefined);
          else {
            const matched = opts.find((o) => String(o.value) === raw);
            onChange(matched?.value);
          }
        }}
      >
        <SelectTrigger className="ev-mf-chip-select-trigger">
          <SelectValue placeholder={definition.placeholder ?? 'Seleccionar'} />
        </SelectTrigger>
        <SelectContent>
          {opts.map((o) => (
            <SelectItem key={String(o.value)} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ev-mf-chip-remove"
        >
          <X />
        </button>
      )}
    </div>
  );
}
