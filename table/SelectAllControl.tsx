import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
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
    <div className="flex items-center gap-1">
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
              className="flex h-5 w-5 items-center justify-center rounded border border-border bg-background hover:bg-muted"
              aria-label="Toggle select-all scope"
            >
              <ChevronDown className="h-3.5 w-3.5" />
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
