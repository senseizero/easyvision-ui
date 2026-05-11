import * as React from 'react';
import type { Table } from '@tanstack/react-table';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Settings2 } from 'lucide-react';

export interface ColumnVisibilityMenuProps<T> {
  table: Table<T>;
  label: string;
}

export function ColumnVisibilityMenu<T>({ table, label }: ColumnVisibilityMenuProps<T>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="ev-cv-icon" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="ev-cv-menu">
        {table
          .getAllColumns()
          .filter((col) => col.getCanHide() && col.id !== '_select')
          .map((col) => {
            const rawHeader = col.columnDef.header;
            const headerLabel =
              typeof rawHeader === 'string' && rawHeader.trim().length > 0
                ? rawHeader
                : col.id;
            return (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(v) => col.toggleVisibility(!!v)}
                className="ev-cv-item"
              >
                {headerLabel}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
