"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type NotchedInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode
  error?: boolean
  rightAdornment?: React.ReactNode
}

export const NotchedInput = React.forwardRef<HTMLInputElement, NotchedInputProps>(
  ({ className, label, error, rightAdornment, placeholder, id, ...props }, ref) => {
    // Use a blank placeholder to enable :placeholder-shown based transitions
    const ph = placeholder ?? " "
    const rootRef = React.useRef<HTMLDivElement>(null)
    const labelMeasureRef = React.useRef<HTMLSpanElement>(null)

    React.useLayoutEffect(() => {
      const update = () => {
        const w = labelMeasureRef.current?.offsetWidth ?? 0
        rootRef.current?.style.setProperty('--ni-notch-w', `${w + 8}px`) // +8px padding for notch
      }
      update()
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }, [label])

    return (
      <div ref={rootRef} className={cn("relative", className)}>
        {/* The interactive input */}
        <input
          id={id}
          ref={ref}
          placeholder={ph}
          className={cn(
            "peer h-12 w-full rounded-md bg-background px-3 pr-10 text-base focus:outline-none md:text-sm",
            // Hide the native border; we draw our own with the fieldset
            "border-0 ring-0",
            // Disabled styles parity with default input
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        />

        {/* Notched border using fieldset/legend (decorative) */}
        <fieldset
          aria-hidden
          role="presentation"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-md border transition-colors",
            error ? "border-destructive" : "border-input",
            "peer-focus:border-primary"
          )}
        >
          <legend
            className={cn(
              // Prevent stray line fragments when collapsed
              "block h-0 p-0 m-0 text-[0] leading-[0] overflow-hidden",
              // Smoothly expand/collapse the notch width
              "transition-[max-width] duration-200 ease-out",
              // Hidden by default
              "max-w-0",
              // Show notch on focus or when input has value
              "peer-focus:max-w-[var(--ni-notch-w)] peer-[:not(:placeholder-shown)]:max-w-[var(--ni-notch-w)]"
            )}
          >
            {/* Invisible content defines the notch width */}
            <span className="invisible px-1 text-xs">{typeof label === 'string' ? label : ''}</span>
          </legend>
        </fieldset>

        {/* Floating label text (visible) */}
        <label
          htmlFor={id}
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground",
            "transition-all",
            // When focused or filled, float above and shrink
            "peer-focus:-top-2.5 peer-[:not(:placeholder-shown)]:-top-2.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:text-xs",
            // Place a small background so text is readable above border
            "px-1 bg-background"
          )}
        >
          <span ref={labelMeasureRef}>{label}</span>
        </label>

        {rightAdornment && (
          <div className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2">
            {rightAdornment}
          </div>
        )}
      </div>
    )
  }
)
NotchedInput.displayName = "NotchedInput"

export default NotchedInput
