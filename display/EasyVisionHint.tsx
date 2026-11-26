import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

export interface EasyVisionHintProps {
  /** Bold first line of the popup. */
  title?: ReactNode;
  /** Body of the popup; line breaks are kept. */
  children: ReactNode;
  /** Accessible name of the ⓘ trigger. */
  label: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Widest the popup grows, in px. */
  maxWidth?: number;
}

/** A small ⓘ that shows a longer text on hover or keyboard focus. */
export function EasyVisionHint({
  title,
  children,
  label,
  side = 'top',
  maxWidth = 420,
}: EasyVisionHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        className="ev-hint"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        render={<button type="button" />}
      >
        <Info size={16} aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side={side} style={{ maxWidth }} className="ev-hint-content">
        {title != null && <b>{title}</b>}
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
