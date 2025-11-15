"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import NotchedInput from "@/components/ui/notched-input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DateTimeFieldProps {
  label: React.ReactNode
  value: string
  onChange: (next: string) => void
  className?: string
}

const parseValue = (value: string) => {
  if (!value) return { date: null as Date | null, time: "" }
  try {
    const [datePart, timePart = ""] = value.split("T")
    const [year, month, day] = datePart.split("-").map(Number)
    const date = new Date(year, (month || 1) - 1, day || 1)
    return { date, time: timePart.slice(0, 5) }
  } catch {
    return { date: null as Date | null, time: "" }
  }
}

const formatValue = (date: Date | null, time: string) => {
  if (!date) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const t = time && time.length >= 4 ? time : "12:00"
  return `${y}-${m}-${d}T${t}`
}

const formatDisplay = (value: string) => {
  const { date, time } = parseValue(value)
  if (!date) return "dd.mm.rrrr, --:--"
  const pad = (n: number) => String(n).padStart(2, "0")
  const d = pad(date.getDate())
  const m = pad(date.getMonth() + 1)
  const y = date.getFullYear()
  const t = time && time.length >= 4 ? time : "--:--"
  return `${d}.${m}.${y}, ${t}`
}

export function DateTimeField({ label, value, onChange, className }: DateTimeFieldProps) {
  const [open, setOpen] = React.useState(false)
  const { date, time } = parseValue(value)
  const [localTime, setLocalTime] = React.useState(time)

  React.useEffect(() => {
    setLocalTime(parseValue(value).time)
  }, [value])

  const handleSelect = (next: Date | undefined) => {
    if (!next) return
    onChange(formatValue(next, localTime))
  }

  const handleTime = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = event.target.value
    setLocalTime(nextTime)
    onChange(formatValue(date ?? new Date(), nextTime))
  }

  const display = formatDisplay(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("cursor-pointer", className)}>
          <NotchedInput
            borderless
            label={label}
            value={display}
            readOnly
            onChange={() => {}}
            rightAdornment={<CalendarIcon className="h-4 w-4 text-muted-foreground" />}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-2 p-2">
          <Calendar
            mode="single"
            selected={date ?? undefined}
            onSelect={handleSelect}
            fixedWeeks
            className="rounded-xl border border-border/40 bg-popover"
          />
          <div className="flex items-center justify-between gap-3 px-1 pb-1">
            <input
              type="time"
              value={localTime}
              onChange={handleTime}
              className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              OK
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default DateTimeField
