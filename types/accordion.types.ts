import type { ReactNode } from 'react';

/** A single unfoldable question/answer entry for the data-driven API. */
export interface AccordionItem {
  /** Stable key, also used to track open state. */
  id: string;
  /** Header content — a string or any node (e.g. icon + label). */
  question: ReactNode;
  /** Free-format body revealed when the item is expanded. */
  content: ReactNode;
  /** Start expanded (uncontrolled mode only). */
  defaultOpen?: boolean;
  /** Render the trigger as non-interactive. */
  disabled?: boolean;
}

/** 'single' = one item open at a time; 'multiple' = items open independently. */
export type AccordionMode = 'single' | 'multiple';

export interface EasyVisionAccordionProps {
  /** Data-driven items. Omit when composing <EasyVisionAccordionItem> children instead. */
  items?: AccordionItem[];
  /** Compound children (alternative to `items`). */
  children?: ReactNode;
  /** Open behaviour. Default: 'single'. */
  mode?: AccordionMode;
  /** Controlled set of open ids. When provided the component is fully controlled. */
  openIds?: string[];
  /** Uncontrolled initial open ids (ignored when `openIds` is set). */
  defaultOpenIds?: string[];
  /** Fired whenever the open set changes, with the next list of open ids. */
  onOpenChange?: (openIds: string[]) => void;
  className?: string;
}

export interface EasyVisionAccordionItemProps {
  /** Stable key, also used to track open state. */
  id: string;
  /** Header content — a string or any node. */
  question: ReactNode;
  /** Free-format body revealed when expanded. */
  children: ReactNode;
  /** Start expanded (uncontrolled mode only). */
  defaultOpen?: boolean;
  /** Render the trigger as non-interactive. */
  disabled?: boolean;
  className?: string;
}
