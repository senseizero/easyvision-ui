import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
