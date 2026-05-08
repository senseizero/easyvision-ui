import * as React from 'react';
import { TextWidget } from './widgets/TextWidget';
import { SelectorWidget } from './widgets/SelectorWidget';
import { MultiSelectWidget } from './widgets/MultiSelectWidget';
import { DateRangeWidget } from './widgets/DateRangeWidget';
import { NumberRangeWidget } from './widgets/NumberRangeWidget';
import type {
  FieldDef,
  DateRangeValue,
  NumberRangeValue,
} from '../types/multifilter.types';

export interface MultifilterFieldProps {
  definition: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onRemove?: () => void;
}

export function MultifilterField({
  definition,
  value,
  onChange,
  onRemove,
}: MultifilterFieldProps) {
  switch (definition.type) {
    case 'text':
      return (
        <TextWidget
          definition={definition}
          value={value as string | undefined}
          onChange={(v) => onChange(v)}
          onRemove={onRemove}
        />
      );
    case 'selector':
      return (
        <SelectorWidget
          definition={definition}
          value={value as string | number | undefined}
          onChange={(v) => onChange(v)}
          onRemove={onRemove}
        />
      );
    case 'multiselect':
      return (
        <MultiSelectWidget
          definition={definition}
          value={value as (string | number)[] | undefined}
          onChange={(v) => onChange(v)}
          onRemove={onRemove}
        />
      );
    case 'dateRange':
      return (
        <DateRangeWidget
          definition={definition}
          value={value as DateRangeValue | undefined}
          onChange={(v) => onChange(v)}
          onRemove={onRemove}
        />
      );
    case 'numberRange':
      return (
        <NumberRangeWidget
          definition={definition}
          value={value as NumberRangeValue | undefined}
          onChange={(v) => onChange(v)}
          onRemove={onRemove}
        />
      );
    case 'custom': {
      const Component = definition.component;
      return (
        <Component
          definition={definition}
          value={value}
          onChange={onChange}
          onRemove={onRemove ?? (() => {})}
        />
      );
    }
    case 'multifilter':
      // Nested multifilters are rendered by EasyVisionMultifilter directly,
      // not via this dispatcher (it owns its own slice + Buscar).
      return null;
    default:
      return null;
  }
}
