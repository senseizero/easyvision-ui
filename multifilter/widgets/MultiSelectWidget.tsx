import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { ChevronDown, X } from 'lucide-react';
import type { MultiSelectFieldDef } from '../../types/multifilter.types';
import type { SelectorOption } from '../../types/common.types';

export interface MultiSelectWidgetProps {
  definition: MultiSelectFieldDef;
  value: (string | number)[] | undefined;
  onChange: (value: (string | number)[]) => void;
  onRemove?: () => void;
}

export function MultiSelectWidget({
  definition,
  value,
  onChange,
  onRemove,
}: MultiSelectWidgetProps) {
  const [search, setSearch] = useState('');
  const [resolved, setResolved] = useState<SelectorOption[] | null>(
    Array.isArray(definition.options) ? (definition.options as SelectorOption[]) : null
  );

  useEffect(() => {
    if (typeof definition.options === 'function' && resolved === null) {
      void (definition.options as () => Promise<SelectorOption[]>)()
        .then(setResolved)
        .catch(() => setResolved([]));
    } else if (Array.isArray(definition.options)) {
      setResolved(definition.options as SelectorOption[]);
    }
  }, [definition.options, resolved]);

  const selected = Array.isArray(value) ? value : [];
  const opts = resolved ?? [];

  const filtered = useMemo(
    () => opts.filter((o) => o.label.toLowerCase().includes(search.toLowerCase())),
    [opts, search]
  );

  const toggle = (v: string | number) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  const removeOne = (v: string | number) => onChange(selected.filter((x) => x !== v));
  const labelOf = (v: string | number) => opts.find((o) => o.value === v)?.label ?? String(v);

  return (
    <div className="ev-mf-chip is-wrap">
      <span className="ev-mf-chip-label">
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}:
      </span>
      {selected.map((v) => (
        <span key={String(v)} className="ev-mf-chip-badge">
          {labelOf(v)}
          <button
            type="button"
            onClick={() => removeOne(v)}
            className="ev-mf-chip-badge-x"
          >
            <X />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="ev-mf-chip-caret">
            <ChevronDown />
          </button>
        </PopoverTrigger>
        <PopoverContent className="ev-mf-ms-popover" align="start">
          <Input
            className="ev-mf-ms-search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ev-mf-ms-list">
            {filtered.map((o) => (
              <label key={String(o.value)} className="ev-mf-ms-option">
                <Checkbox
                  checked={selected.includes(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                />
                {o.label}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="ev-mf-ms-empty">Sin opciones</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
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
