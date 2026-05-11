import * as React from 'react';
import { Input } from '../../ui/input';
import { X } from 'lucide-react';
import type { MultifilterFieldBase } from '../../types/multifilter.types';

export interface TextWidgetProps {
  definition: MultifilterFieldBase;
  value: string | undefined;
  onChange: (value: string) => void;
  onRemove?: () => void;
}

export function TextWidget({ definition, value, onChange, onRemove }: TextWidgetProps) {
  return (
    <div className="ev-mf-chip">
      <span className="ev-mf-chip-label">
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}:
      </span>
      <Input
        className="ev-mf-chip-input"
        placeholder={definition.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
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
