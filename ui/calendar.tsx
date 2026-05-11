import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "./utils"
import { buttonVariants } from "./button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("ev-cal", className)}
      classNames={{
        months: "ev-cal-months",
        month: "ev-cal-month",
        caption: "ev-cal-caption",
        caption_label: "ev-cal-caption-label",
        nav: "ev-cal-nav",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "ev-cal-nav-button"
        ),
        nav_button_previous: "ev-cal-nav-button-previous",
        nav_button_next: "ev-cal-nav-button-next",
        table: "ev-cal-table",
        head_row: "ev-cal-head-row",
        head_cell: "ev-cal-head-cell",
        row: "ev-cal-row",
        cell: "ev-cal-cell",
        day: cn(buttonVariants({ variant: "ghost" }), "ev-cal-day"),
        day_range_end: "day-range-end",
        day_selected: "ev-cal-day-selected",
        day_today: "ev-cal-day-today",
        day_outside: "day-outside ev-cal-day-outside",
        day_disabled: "ev-cal-day-disabled",
        day_range_middle: "ev-cal-day-range-middle",
        day_hidden: "ev-cal-day-hidden",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("ev-cal-icon", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("ev-cal-icon", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
