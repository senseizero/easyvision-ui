import * as React from 'react';
import { Search, X } from 'lucide-react';
import type { TextFieldDef } from '../types/multifilter.types';
import { toSearchTerms } from './hooks/useMultifilterQuery';

interface SearchBarProps {
  def: TextFieldDef;
  /** The terms (a single string, from older state, reads as one). */
  value: unknown;
  onChange: (terms: string[]) => void;
  placeholder: string;
  /** Enter with nothing typed, or after fixing a term: search now (manual mode). */
  onSubmit: () => void;
  onRemoveField?: () => void;
  labels: { clear: string; removeValue: string };
}

/**
 * The main search: several terms, any of which matches. What is being typed
 * is searched as it is typed (it is the last term); Enter fixes it as a chip
 * and frees the box for another; a chip's × or Backspace on an empty box
 * takes one off. With one term it is the single search it always was.
 */
export function SearchBar({
  def,
  value,
  onChange,
  placeholder,
  onSubmit,
  onRemoveField,
  labels,
}: SearchBarProps) {
  const terms = toSearchTerms(value);
  const [draft, setDraft] = React.useState('');
  const typed = draft.trim();
  // The draft is the last term while it is being typed.
  const chips = typed && terms[terms.length - 1] === typed ? terms.slice(0, -1) : terms;

  // Terms set from outside (a saved query, Limpiar, a link) leave no draft.
  React.useEffect(() => {
    if (typed && terms[terms.length - 1] !== typed) setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (next: string[]) => onChange([...new Set(next.map((t) => t.trim()).filter(Boolean))]);

  return (
    <div className={['ev-mf-search-slot', onRemoveField ? 'has-clear' : 'no-clear'].join(' ')}>
      <Search className="ev-mf-search-icon" />
      {chips.map((term) => (
        <span key={term} className="ev-mf-search-term">
          {term}
          <button
            type="button"
            className="ev-mf-chip-badge-x"
            aria-label={`${labels.removeValue} ${term}`}
            onClick={() => emit([...chips.filter((t) => t !== term), draft])}
          >
            <X />
          </button>
        </span>
      ))}
      <input
        className="ev-mf-search-input"
        aria-label={def.label}
        placeholder={chips.length ? '' : placeholder}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          emit([...chips, e.target.value]);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // The term is already searched; it only becomes a chip.
            setDraft('');
            onSubmit();
          } else if (e.key === 'Backspace' && draft === '' && chips.length > 0) {
            emit(chips.slice(0, -1));
          }
        }}
      />
      {onRemoveField && (
        <button
          type="button"
          onClick={onRemoveField}
          aria-label={labels.clear}
          className="ev-mf-search-clear"
        >
          <X />
        </button>
      )}
    </div>
  );
}
