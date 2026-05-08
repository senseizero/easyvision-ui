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
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {definition.label}
        {definition.mandatory && <span className="ml-0.5 text-destructive">*</span>}:
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs hover:text-foreground"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
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
          className="ml-1 p-0.5 hover:bg-muted rounded transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
