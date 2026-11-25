import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "./utils"

/**
 * shadcn's base-nova popover (Base UI), with easyvision's `ev-*` classes in
 * place of Tailwind: the look lives in easyvision.css.
 */
const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="ev-positioner"
      >
        <PopoverPrimitive.Popup
          className={cn("ev-popover-content", className)}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
