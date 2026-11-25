import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Check, Search } from "lucide-react"

import { cn } from "./utils"

/**
 * The parts of shadcn's base-nova combobox (Base UI) that the searchable
 * selector uses — a trigger button, and inside the popup a search input over a
 * filtered list — with easyvision's `ev-cmd-*` classes (the look cmdk had).
 */
const Combobox = ComboboxPrimitive.Root
const ComboboxTrigger = ComboboxPrimitive.Trigger

function ComboboxContent({
  className,
  align = "start",
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props &
  Pick<ComboboxPrimitive.Positioner.Props, "align" | "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner className="ev-positioner" align={align} sideOffset={sideOffset}>
        <ComboboxPrimitive.Popup className={cn("ev-popover-content ev-cmd", className)} {...props} />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <div className="ev-cmd-input-wrapper">
      <Search className="ev-cmd-input-icon" />
      <ComboboxPrimitive.Input className={cn("ev-cmd-input", className)} {...props} />
    </div>
  )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
  return <ComboboxPrimitive.List className={cn("ev-cmd-list ev-cmd-group", className)} {...props} />
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return <ComboboxPrimitive.Empty className={cn("ev-cmd-empty", className)} {...props} />
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item className={cn("ev-cmd-item", className)} {...props}>
      <ComboboxPrimitive.ItemIndicator
        keepMounted
        // Always drawn (hidden when not picked) so labels stay aligned; the
        // indicator's own default content is dropped.
        render={({ children: _default, ...indicatorProps }, state) => (
          <span {...indicatorProps}>
            <Check className={cn("ev-selector-item-check", !state.selected && "is-hidden")} />
          </span>
        )}
      />
      {children}
    </ComboboxPrimitive.Item>
  )
}

export {
  Combobox,
  ComboboxTrigger,
  ComboboxContent,
  ComboboxInput,
  ComboboxList,
  ComboboxEmpty,
  ComboboxItem,
}
