import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "./utils"

/** shadcn's base-nova checkbox (Base UI) with easyvision's `ev-*` classes. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root className={cn("ev-checkbox", className)} {...props}>
      <CheckboxPrimitive.Indicator
        className="ev-checkbox-indicator"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? <Minus /> : <Check />}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
