import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {definition.label}
        {definition.mandatory && <span className="ml-0.5 text-destructive">*</span>}:
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
        <SelectTrigger className="h-7 min-w-[120px] border-0 bg-transparent p-0 px-2 text-xs focus:ring-0 focus:ring-offset-0">
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
          className="ml-1 p-0.5 hover:bg-muted rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
