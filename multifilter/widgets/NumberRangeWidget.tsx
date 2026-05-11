import * as React from 'react';
import { Input } from '../../ui/input';
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
    <div className="ev-mf-chip">
      <span className="ev-mf-chip-label">
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}:
      </span>
      <Input
        type="number"
        className="ev-mf-chip-number"
        placeholder="Min"
        value={range.min ?? ''}
        onChange={(e) =>
          onChange({ ...range, min: e.target.value ? Number(e.target.value) : undefined })
        }
      />
      <span className="ev-mf-chip-dash">—</span>
      <Input
        type="number"
        className="ev-mf-chip-number"
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
          className="ev-mf-chip-remove"
        >
          <X />
        </button>
      )}
    </div>
  );
}
