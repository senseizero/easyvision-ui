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
    <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {definition.label}
        {definition.mandatory && <span className="ml-0.5 text-destructive">*</span>}:
      </span>
      {selected.map((v) => (
        <span
          key={String(v)}
          className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-md"
        >
          {labelOf(v)}
          <button
            type="button"
            onClick={() => removeOne(v)}
            className="p-0.5 hover:bg-muted rounded"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <Input
            className="mb-2 h-8 text-xs"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((o) => (
              <label
                key={String(o.value)}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-muted"
              >
                <Checkbox
                  checked={selected.includes(o.value)}
                  onCheckedChange={() => toggle(o.value)}
                />
                {o.label}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">Sin opciones</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 p-0.5 hover:bg-muted rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
