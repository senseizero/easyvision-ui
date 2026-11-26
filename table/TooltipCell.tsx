import * as React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]';
// A hint (or any tooltip) inside the cell has its own popup: the cell's waits.
const NESTED = '.ev-hint,.ev-tooltip-content';

/**
 * A truncating cell whose full text opens in a tooltip. The cell is a tab stop
 * (and carries the text as `aria-description`) only when its content has no
 * focusable element of its own: otherwise that element opens the tooltip on
 * focus and describes itself. Hovering or focusing a nested hint shows the
 * hint alone.
 */
export function TooltipCell({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [selfFocusable, setSelfFocusable] = useState(false);
  const [open, setOpen] = useState(false);
  const nested = useRef(false);

  useLayoutEffect(() => {
    const none = !ref.current?.querySelector(FOCUSABLE);
    setSelfFocusable((prev) => (prev === none ? prev : none));
  });

  const enter = (e: React.SyntheticEvent) => {
    const inside = (e.target as Element).closest?.(NESTED) != null;
    if (inside === nested.current) return;
    nested.current = inside;
    // Leaving the hint for the cell's own text brings the tooltip back.
    setOpen(!inside);
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => setOpen(next && !nested.current)}
    >
      <TooltipTrigger
        ref={ref}
        delay={300}
        className="ev-table-cell-truncate-inner"
        tabIndex={selfFocusable ? 0 : undefined}
        aria-description={selfFocusable ? text : undefined}
        onPointerOver={enter}
        onFocus={enter}
        render={<div />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" style={{ maxWidth: 420 }}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
