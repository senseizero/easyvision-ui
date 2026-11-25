import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "./utils"

const buttonVariants = cva("ev-btn", {
  variants: {
    variant: {
      default: "ev-btn-default",
      destructive: "ev-btn-destructive",
      outline: "ev-btn-outline",
      secondary: "ev-btn-secondary",
      ghost: "ev-btn-ghost",
      link: "ev-btn-link",
    },
    size: {
      default: "ev-btn-size-default",
      sm: "ev-btn-size-sm",
      lg: "ev-btn-size-lg",
      icon: "ev-btn-size-icon",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

/**
 * A plain button with easyvision's variants. A trigger that should look like
 * one takes it as `render={<Button variant=… />}` (Base UI), not `asChild`.
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
