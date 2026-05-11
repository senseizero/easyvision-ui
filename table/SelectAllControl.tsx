import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Checkbox } from '../ui/checkbox';
import { ChevronDown } from 'lucide-react';

export interface SelectAllControlProps {
  /** Current scope. */
  scope: 'page' | 'all';
  /** Whether scope can be toggled by the user (when prop selectAllScope === 'toggleable'). */
  toggleable: boolean;
  /** Header checkbox state derived from selection. */
  state: 'unchecked' | 'indeterminate' | 'checked';
  onToggle: (checked: boolean) => void;
  onScopeChange: (scope: 'page' | 'all') => void;
  labels: {
    selectAllPage: string;
    selectAllAll: string;
  };
}

export function SelectAllControl({
  scope,
  toggleable,
  state,
  onToggle,
  onScopeChange,
  labels,
}: SelectAllControlProps) {
  return (
    <div className="ev-sa-control">
      <Checkbox
        checked={state === 'checked' ? true : state === 'indeterminate' ? 'indeterminate' : false}
        onCheckedChange={(c) => onToggle(!!c)}
        aria-label="Select all"
      />
      {toggleable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ev-sa-toggle"
              aria-label="Toggle select-all scope"
            >
              <ChevronDown className="ev-sa-toggle-icon" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={scope}
              onValueChange={(v) => onScopeChange(v as 'page' | 'all')}
            >
              <DropdownMenuRadioItem value="page">{labels.selectAllPage}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="all">{labels.selectAllAll}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
