import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "./utils"
import { buttonVariants } from "./button"

/**
 * react-day-picker 9 with easyvision's `ev-cal-*` classes. In v9 the "day" is
 * the cell (it carries selected/today/range…), and the button sits inside it.
 */
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
        month_caption: "ev-cal-caption",
        caption_label: "ev-cal-caption-label",
        nav: "ev-cal-nav",
        button_previous: cn(buttonVariants({ variant: "outline" }), "ev-cal-nav-button"),
        button_next: cn(buttonVariants({ variant: "outline" }), "ev-cal-nav-button"),
        month_grid: "ev-cal-table",
        weekdays: "ev-cal-head-row",
        weekday: "ev-cal-head-cell",
        week: "ev-cal-row",
        day: "ev-cal-cell",
        day_button: cn(buttonVariants({ variant: "ghost" }), "ev-cal-day"),
        selected: "ev-cal-selected",
        range_start: "ev-cal-range-start",
        range_middle: "ev-cal-range-middle",
        range_end: "ev-cal-range-end",
        today: "ev-cal-today",
        outside: "ev-cal-outside",
        disabled: "ev-cal-disabled",
        hidden: "ev-cal-hidden",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("ev-cal-icon", className)} />
          ) : (
            <ChevronRight className={cn("ev-cal-icon", className)} />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
