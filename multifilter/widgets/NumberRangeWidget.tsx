import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';
import type {
  NumberRangeFieldDef,
  NumberRangeValue,
} from '../../types/multifilter.types';

export interface NumberRangeWidgetProps {
  definition: NumberRangeFieldDef;
  value: NumberRangeValue | undefined;
  onChange: (value: NumberRangeValue) => void;
  onRemove?: () => void;
}

export function NumberRangeWidget({
  definition,
  value,
  onChange,
  onRemove,
}: NumberRangeWidgetProps) {
  const range = value ?? {};
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {definition.label}
        {definition.mandatory && <span className="ml-0.5 text-destructive">*</span>}:
      </span>
      <Input
        type="number"
        className="h-7 w-20 border-0 bg-transparent p-0 px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Min"
        value={range.min ?? ''}
        onChange={(e) =>
          onChange({ ...range, min: e.target.value ? Number(e.target.value) : undefined })
        }
      />
      <span className="text-xs text-muted-foreground">—</span>
      <Input
        type="number"
        className="h-7 w-20 border-0 bg-transparent p-0 px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder="Max"
        value={range.max ?? ''}
        onChange={(e) =>
          onChange({ ...range, max: e.target.value ? Number(e.target.value) : undefined })
        }
      />
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
