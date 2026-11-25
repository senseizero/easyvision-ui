import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "./utils"

/** shadcn's base-nova dropdown menu (Base UI Menu) with easyvision's `ev-*` classes. */
const DropdownMenu = MenuPrimitive.Root
const DropdownMenuTrigger = MenuPrimitive.Trigger
const DropdownMenuPortal = MenuPrimitive.Portal
const DropdownMenuGroup = MenuPrimitive.Group
const DropdownMenuSub = MenuPrimitive.SubmenuRoot
const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="ev-positioner"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup className={cn("ev-dropdown-content", className)} {...props} />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn("ev-dropdown-sub-trigger", inset && "ev-dropdown-inset", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ev-dropdown-sub-trigger-chevron" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      className={cn("ev-dropdown-sub-content", className)}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  )
}

function DropdownMenuItem({
  className,
  inset,
  ...props
}: MenuPrimitive.Item.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn("ev-dropdown-item", inset && "ev-dropdown-inset", className)}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem className={cn("ev-dropdown-checkbox-item", className)} {...props}>
      <span className="ev-dropdown-item-indicator">
        <MenuPrimitive.CheckboxItemIndicator>
          <Check />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem className={cn("ev-dropdown-radio-item", className)} {...props}>
      <span className="ev-dropdown-item-indicator ev-dropdown-radio-indicator">
        <MenuPrimitive.RadioItemIndicator>
          <Circle />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & { inset?: boolean }) {
  return (
    <MenuPrimitive.GroupLabel
      className={cn("ev-dropdown-label", inset && "ev-dropdown-inset", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return <MenuPrimitive.Separator className={cn("ev-dropdown-separator", className)} {...props} />
}

function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ev-dropdown-shortcut", className)} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
