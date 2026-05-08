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
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {definition.label}
        {definition.mandatory && <span className="ml-0.5 text-destructive">*</span>}:
      </span>
      <Input
        className="h-7 min-w-[112px] w-28 border-0 bg-transparent p-0 px-2 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
        placeholder={definition.placeholder}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
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
