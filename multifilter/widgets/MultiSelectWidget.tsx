import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../ui/popover';
import { Input } from '../../ui/input';
import { Checkbox } from '../../ui/checkbox';
import { ChevronDown, X } from 'lucide-react';
import type { MultiSelectFieldDef } from '../../types/multifilter.types';
import type { SelectorOption } from '../../types/common.types';

export interface MultiSelectWidgetProps {
  definition: MultiSelectFieldDef;
  value: (string | number)[] | undefined;
  onChange: (value: (string | number)[]) => void;
  onRemove?: () => void;
}

export function MultiSelectWidget({
  definition,
  value,
  onChange,
  onRemove,
}: MultiSelectWidgetProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const searchFn = definition.searchOptions;
  const hasSearchOptions = typeof searchFn === 'function';

  // Static / once-on-mount options. Used for label resolution, and — when no
  // `searchOptions` is provided — as the in-memory filtered list.
  const [resolved, setResolved] = useState<SelectorOption[] | null>(
    Array.isArray(definition.options)
      ? (definition.options as SelectorOption[])
      : null
  );

  useEffect(() => {
    if (typeof definition.options === 'function' && resolved === null) {
      void (definition.options as () => Promise<SelectorOption[]>)()
        .then(setResolved)
        .catch(() => setResolved([]));
    } else if (Array.isArray(definition.options)) {
      setResolved(definition.options as SelectorOption[]);
    }
  }, [definition.options, resolved]);

  // Per-keystroke search results (only when `searchOptions` is set). Debounced
  // at 300ms to match `EasyVisionInput`'s typing debounce; stale responses are
  // dropped via the `cancelled` guard.
  const [searchResults, setSearchResults] = useState<SelectorOption[]>([]);
  useEffect(() => {
    if (!searchFn) return;
    if (search.trim() === '') {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void searchFn(search)
        .then((r) => {
          if (!cancelled) setSearchResults(r);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [search, searchFn]);

  const selected = Array.isArray(value) ? value : [];
  const baseOpts = resolved ?? [];

  // Remembers labels for selected values so the badges stay readable after the
  // search box is cleared (the persisted value list alone carries no labels).
  const labelCache = useRef<Map<string | number, string>>(new Map());
  useEffect(() => {
    baseOpts.forEach((o) => labelCache.current.set(o.value, o.label));
  }, [baseOpts]);

  const listOpts = useMemo(() => {
    if (hasSearchOptions) return searchResults;
    return baseOpts.filter((o) =>
      o.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [hasSearchOptions, searchResults, baseOpts, search]);

  const select = (opt: SelectorOption) => {
    labelCache.current.set(opt.value, opt.label);
    onChange(
      selected.includes(opt.value)
        ? selected.filter((x) => x !== opt.value)
        : [...selected, opt.value]
    );
  };
  const removeOne = (v: string | number) =>
    onChange(selected.filter((x) => x !== v));
  const labelOf = (v: string | number) =>
    labelCache.current.get(v) ??
    baseOpts.find((o) => o.value === v)?.label ??
    String(v);

  return (
    <div className="ev-mf-chip is-wrap">
      <span
        className="ev-mf-chip-label is-clickable"
        onClick={() => setOpen(true)}
      >
        {definition.label}
        {definition.mandatory && <span className="ev-mf-chip-required">*</span>}
        :
      </span>
      {selected.map((v) => (
        <span key={String(v)} className="ev-mf-chip-badge">
          {labelOf(v)}
          <button
            type="button"
            onClick={() => removeOne(v)}
            className="ev-mf-chip-badge-x"
          >
            <X />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="ev-mf-chip-caret">
            <ChevronDown />
          </button>
        </PopoverTrigger>
        <PopoverContent className="ev-mf-ms-popover" align="start">
          <Input
            className="ev-mf-ms-search"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ev-mf-ms-list">
            {listOpts.map((o) => (
              <label key={String(o.value)} className="ev-mf-ms-option">
                <Checkbox
                  checked={selected.includes(o.value)}
                  onCheckedChange={() => select(o)}
                />
                {o.label}
              </label>
            ))}
            {listOpts.length === 0 && (
              <p className="ev-mf-ms-empty">
                {hasSearchOptions && search.trim() === ''
                  ? 'Escribe para buscar...'
                  : 'Sin opciones'}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {onRemove && (
        <button type="button" onClick={onRemove} className="ev-mf-chip-remove">
          <X />
        </button>
      )}
    </div>
  );
}
