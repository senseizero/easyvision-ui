import * as React from 'react';

/**
 * EasyVisionCard
 *
 * Self-contained card primitive for the EasyVision library. Mirrors the
 * Shadcn Card API (Card / Header / Title / Description / Content / Footer)
 * but lives inside EasyVision so consumers can use the library without
 * having to install or maintain a separate Shadcn `card` component.
 *
 * Visual surface relies only on Tailwind design tokens (`bg-card`,
 * `text-card-foreground`, `border`, `shadow-sm`) that any Tailwind/Shadcn-
 * themed host project already exposes via CSS variables. No JS
 * dependency on `@/components/ui` — the library is portable.
 *
 * Usage:
 *   import { EasyVisionCard, EasyVisionCardContent } from '@easyvision/easyvision-ui';
 */

const join = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

const EasyVisionCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={join('ev-card', className)} {...props} />
));
EasyVisionCard.displayName = 'EasyVisionCard';

const EasyVisionCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={join('ev-card-header', className)} {...props} />
));
EasyVisionCardHeader.displayName = 'EasyVisionCardHeader';

const EasyVisionCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3 ref={ref} className={join('ev-card-title', className)} {...props}>
    {children}
  </h3>
));
EasyVisionCardTitle.displayName = 'EasyVisionCardTitle';

const EasyVisionCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={join('ev-card-description', className)} {...props} />
));
EasyVisionCardDescription.displayName = 'EasyVisionCardDescription';

const EasyVisionCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={join('ev-card-content', className)} {...props} />
));
EasyVisionCardContent.displayName = 'EasyVisionCardContent';

const EasyVisionCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={join('ev-card-footer', className)} {...props} />
));
EasyVisionCardFooter.displayName = 'EasyVisionCardFooter';

export {
  EasyVisionCard,
  EasyVisionCardHeader,
  EasyVisionCardTitle,
  EasyVisionCardDescription,
  EasyVisionCardContent,
  EasyVisionCardFooter,
};
