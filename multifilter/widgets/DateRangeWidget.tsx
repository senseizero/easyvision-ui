import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { Calendar } from '../../ui/calendar';
import type {
  DateRangeFieldDef,
  DateRangeValue,
} from '../../types/multifilter.types';

export interface DateRangeWidgetProps {
  definition: DateRangeFieldDef;
  value: DateRangeValue | undefined;
  onChange: (value: DateRangeValue) => void;
  onRemove?: () => void;
}

export function DateRangeWidget({
  definition,
  value,
  onChange,
  onRemove,
}: DateRangeWidgetProps) {
  const range = value ?? {};

  const label = (() => {
    if (range.from && range.to) {
      return `${format(range.from, 'dd/MM/yy', { locale: es })} - ${format(range.to, 'dd/MM/yy', { locale: es })}`;
    }
    if (range.from) return `Desde ${format(range.from, 'dd/MM/yy', { locale: es })}`;
    if (range.to) return `Hasta ${format(range.to, 'dd/MM/yy', { locale: es })}`;
    return definition.placeholder ?? 'Seleccionar rango';
  })();

  return (
    <div className="ev-mf-chip">
      <span className="ev-mf-chip-label">
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}:
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="ev-mf-chip-trigger-btn">
            <CalendarIcon />
            <span>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="ev-mf-daterange-popover" align="start">
          <Calendar
            mode="range"
            selected={{ from: range.from, to: range.to }}
            onSelect={(r) => onChange({ from: r?.from, to: r?.to })}
            numberOfMonths={2}
            locale={es}
          />
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
