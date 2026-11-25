import * as React from 'react';
import { Bookmark, Star, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { MultifilterLabels } from '../types/multifilter.types';
import type { SavedFilter } from './savedFilters';

interface SavedFiltersMenuProps {
  items: SavedFilter[];
  defaultName: string | null;
  /** A search has been applied, so there is something to save. */
  canSave: boolean;
  labels: MultifilterLabels;
  onApply: (saved: SavedFilter) => void;
  onSave: (name: string) => void;
  onDelete: (name: string) => void;
  onSetDefault: (name: string | null) => void;
}

/**
 * "Guardados": one click brings a saved query back, the star makes it the one
 * the multifilter opens with, the bin forgets it. The form at the bottom names
 * what is applied now.
 */
export function SavedFiltersMenu({
  items,
  defaultName,
  canSave,
  labels,
  onApply,
  onSave,
  onDelete,
  onSetDefault,
}: SavedFiltersMenuProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || !canSave) return;
    onSave(trimmed);
    setName('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="ev-mf-saved-btn" />}>
          <Bookmark />
          {labels.saved}
      </PopoverTrigger>
      <PopoverContent className="ev-mf-saved-popover" align="start">
        {items.length === 0 ? (
          <p className="ev-mf-saved-empty">{labels.noSaved}</p>
        ) : (
          <ul className="ev-mf-saved-list" aria-label={labels.saved}>
            {items.map((saved) => {
              const isDefault = saved.name === defaultName;
              return (
                <li key={saved.name} className="ev-mf-saved-item">
                  <button
                    type="button"
                    className="ev-mf-saved-apply"
                    onClick={() => {
                      onApply(saved);
                      setOpen(false);
                    }}
                  >
                    {saved.name}
                  </button>
                  <button
                    type="button"
                    className="ev-mf-saved-icon"
                    data-active={isDefault || undefined}
                    aria-pressed={isDefault}
                    aria-label={`${isDefault ? labels.unsetDefault : labels.setDefault}: ${saved.name}`}
                    title={isDefault ? labels.unsetDefault : labels.setDefault}
                    onClick={() => onSetDefault(isDefault ? null : saved.name)}
                  >
                    <Star />
                  </button>
                  <button
                    type="button"
                    className="ev-mf-saved-icon"
                    aria-label={`${labels.deleteSaved}: ${saved.name}`}
                    title={labels.deleteSaved}
                    onClick={() => onDelete(saved.name)}
                  >
                    <Trash2 />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form
          className="ev-mf-saved-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={canSave ? labels.saveNamePlaceholder : labels.nothingToSave}
            aria-label={labels.saveNamePlaceholder}
            disabled={!canSave}
          />
          <Button type="submit" size="sm" disabled={!canSave || !name.trim()}>
            {labels.save}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
