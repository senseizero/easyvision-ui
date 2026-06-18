import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import type {
  AccordionItem,
  EasyVisionAccordionItemProps,
  EasyVisionAccordionProps,
} from '../types/accordion.types';

/**
 * EasyVisionAccordion
 *
 * Self-contained list of unfoldable questions (FAQ-style). Holds an indefinite
 * number of items and accepts free-format content per item (`question` and the
 * body are both `ReactNode`).
 *
 * Two interchangeable APIs:
 *   - Data-driven: pass `items={[{ id, question, content }]}`.
 *   - Compound: nest `<EasyVisionAccordionItem id question>{body}</...>` children.
 *
 * Open behaviour is configurable via `mode` ('single' default | 'multiple') and
 * may be controlled with `openIds` / `onOpenChange`.
 *
 * Visual surface relies only on Tailwind design tokens (via the `.ev-accordion*`
 * classes in easyvision.css). No JS dependency on `@/components/ui` — portable.
 *
 * Usage:
 *   import { EasyVisionAccordion } from '@easyvision/easyvision-ui';
 */

const join = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

/**
 * Marker component for the compound API. It renders nothing on its own — the
 * parent <EasyVisionAccordion> reads its props and draws the row. Rendering it
 * outside an accordion is a no-op.
 */
function EasyVisionAccordionItem(_props: EasyVisionAccordionItemProps): React.ReactElement | null {
  return null;
}
EasyVisionAccordionItem.displayName = 'EasyVisionAccordionItem';

/** Normalized internal shape shared by the data-driven and compound paths. */
interface NormalizedItem {
  id: string;
  question: React.ReactNode;
  content: React.ReactNode;
  defaultOpen?: boolean;
  disabled?: boolean;
  className?: string;
}

function normalizeFromChildren(children: React.ReactNode): NormalizedItem[] {
  const out: NormalizedItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type !== EasyVisionAccordionItem) return;
    const p = child.props as EasyVisionAccordionItemProps;
    out.push({
      id: p.id,
      question: p.question,
      content: p.children,
      defaultOpen: p.defaultOpen,
      disabled: p.disabled,
      className: p.className,
    });
  });
  return out;
}

function normalizeFromItems(items: AccordionItem[]): NormalizedItem[] {
  return items.map((it) => ({
    id: it.id,
    question: it.question,
    content: it.content,
    defaultOpen: it.defaultOpen,
    disabled: it.disabled,
  }));
}

interface RowProps {
  item: NormalizedItem;
  open: boolean;
  onToggle: (id: string) => void;
}

function AccordionRow({ item, open, onToggle }: RowProps): React.ReactElement {
  const panelId = `ev-accordion-panel-${item.id}`;
  const triggerId = `ev-accordion-trigger-${item.id}`;
  return (
    <div className={join('ev-accordion-item', item.className)}>
      <button
        type="button"
        id={triggerId}
        className={join('ev-accordion-trigger', open && 'ev-accordion-trigger-open')}
        aria-expanded={open}
        aria-controls={panelId}
        disabled={item.disabled}
        onClick={() => onToggle(item.id)}
      >
        <span className="ev-accordion-question">{item.question}</span>
        <ChevronDown className="ev-accordion-icon" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="ev-accordion-panel"
        >
          {item.content}
        </div>
      )}
    </div>
  );
}

function EasyVisionAccordion({
  items,
  children,
  mode = 'single',
  openIds,
  defaultOpenIds,
  onOpenChange,
  className,
}: EasyVisionAccordionProps): React.ReactElement {
  const normalized = React.useMemo(
    () => (items ? normalizeFromItems(items) : normalizeFromChildren(children)),
    [items, children]
  );

  const isControlled = openIds !== undefined;

  const [internalOpen, setInternalOpen] = React.useState<Set<string>>(() => {
    if (defaultOpenIds) return new Set(defaultOpenIds);
    return new Set(normalized.filter((it) => it.defaultOpen).map((it) => it.id));
  });

  const openSet = React.useMemo(
    () => (isControlled ? new Set(openIds) : internalOpen),
    [isControlled, openIds, internalOpen]
  );

  const handleToggle = React.useCallback(
    (id: string) => {
      const next = new Set(openSet);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (mode === 'single') next.clear();
        next.add(id);
      }
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(Array.from(next));
    },
    [openSet, mode, isControlled, onOpenChange]
  );

  return (
    <div className={join('ev-accordion', className)}>
      {normalized.map((item) => (
        <AccordionRow
          key={item.id}
          item={item}
          open={openSet.has(item.id)}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
EasyVisionAccordion.displayName = 'EasyVisionAccordion';

export { EasyVisionAccordion, EasyVisionAccordionItem };
