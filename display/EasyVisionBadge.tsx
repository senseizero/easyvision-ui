import type { ReactNode } from 'react';
import type { Tone } from './tone';

export interface EasyVisionBadgeProps {
  tone?: Tone;
  variant?: 'pill' | 'dot';
  title?: string;
  className?: string;
  children: ReactNode;
}

export function EasyVisionBadge({
  tone = 'neutral',
  variant = 'pill',
  title,
  className,
  children,
}: EasyVisionBadgeProps) {
  return (
    <span
      className={['ev-badge', className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-variant={variant}
      title={title}
    >
      {children}
    </span>
  );
}
