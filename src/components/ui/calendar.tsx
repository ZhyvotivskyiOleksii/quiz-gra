"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export interface CalendarProps extends React.ComponentProps<typeof DayPicker> {
  withDropdowns?: boolean
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  withDropdowns = true,
  fromYear,
  toYear,
  ...props
}: CalendarProps) {
  const hideCaptionLabel = (props as any)?.captionLayout && (props as any).captionLayout !== 'buttons'
  const initialMonth = (props as any)?.month || (props as any)?.selected || new Date()
  const [viewMonth, setViewMonth] = React.useState<Date>(
    initialMonth instanceof Date ? initialMonth : new Date()
  )
  const yFrom = fromYear ?? 1940
  const yTo = toYear ?? new Date().getFullYear()
  const years = React.useMemo(() => {
    const ys: number[] = []
    for (let y = yTo; y >= yFrom; y--) ys.push(y)
    return ys
  }, [yFrom, yTo])
  const months = React.useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Date(2020, i, 1).toLocaleString(undefined, { month: 'long' })
    ),
  [])

  return (
    <div className={cn("p-3", className)}>
      {withDropdowns && (
        <div className="mb-2 flex items-center justify-center gap-2">
          <Select
            value={String(viewMonth.getMonth())}
            onValueChange={(v) => {
              const m = parseInt(v, 10)
              const next = new Date(viewMonth)
              next.setMonth(m)
              setViewMonth(next)
              ;(props as any)?.onMonthChange?.(next)
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom" position="popper">
              {months.map((label, idx) => (
                <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(viewMonth.getFullYear())}
            onValueChange={(v) => {
              const y = parseInt(v, 10)
              const next = new Date(viewMonth)
              next.setFullYear(y)
              setViewMonth(next)
              ;(props as any)?.onMonthChange?.(next)
            }}
          >
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="bottom" position="popper">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <DayPicker
      showOutsideDays={showOutsideDays}
      month={viewMonth}
      onMonthChange={(d) => {
        setViewMonth(d)
        ;(props as any)?.onMonthChange?.(d)
      }}
      className={cn("", undefined)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: hideCaptionLabel ? "sr-only" : "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props}
    />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
