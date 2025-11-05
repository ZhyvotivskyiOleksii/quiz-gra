"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type NotchedInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode
  error?: boolean
  rightAdornment?: React.ReactNode
  borderless?: boolean
  floating?: boolean // when true, use old floating/inside style
}

export const NotchedInput = React.forwardRef<HTMLInputElement, NotchedInputProps>(
  ({ className, label, error, rightAdornment, borderless, floating = false, placeholder, id, ...props }, ref) => {
    const autoId = React.useId()
    const inputId = id || autoId

    // floating mode (legacy style used before): keep original behavior
    if (floating) {
      const ph = placeholder ?? " "
      const rootRef = React.useRef<HTMLDivElement>(null)
      const labelMeasureRef = React.useRef<HTMLSpanElement>(null)
      React.useLayoutEffect(() => {
        const update = () => {
          const w = labelMeasureRef.current?.offsetWidth ?? 0
          rootRef.current?.style.setProperty('--ni-notch-w', `${w + 8}px`)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
      }, [label])
      return (
        <div ref={rootRef} className={cn("relative", className)}>
          <input
            id={inputId}
            ref={ref}
            placeholder={ph}
            className={cn(
              "peer h-10 sm:h-11 w-full rounded-md bg-background px-3 pr-10 text-sm sm:text-base focus:outline-none",
              "border-0 ring-0",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            {...props}
          />
          {!borderless && (
            <fieldset aria-hidden role="presentation" className={cn(
              "pointer-events-none absolute inset-0 rounded-md border transition-colors",
              error ? "border-destructive" : "border-input",
              "peer-focus:border-primary"
            )}>
              <legend className={cn(
                "block h-0 p-0 m-0 text-[0] leading-[0] overflow-hidden",
                "transition-[max-width] duration-200 ease-out",
                "max-w-0",
                "peer-focus:max-w-[var(--ni-notch-w)] peer-[:not(:placeholder-shown)]:max-w-[var(--ni-notch-w)]"
              )}>
                <span className="invisible px-1 text-xs">{typeof label === 'string' ? label : ''}</span>
              </legend>
            </fieldset>
          )}
          <label htmlFor={inputId} className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 text-sm sm:text-base text-muted-foreground",
            "transition-all",
            "peer-focus:-top-2.5 peer-[:not(:placeholder-shown)]:-top-2.5 peer-focus:text-xs peer-[:not(:placeholder-shown)]:text-xs",
            "px-1 bg-background"
          )}>
            <span ref={labelMeasureRef}>{label}</span>
          </label>
          {rightAdornment && (
            <div className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2">{rightAdornment}</div>
          )}
        </div>
      )
    }

    // top label mode (default): label above input; full field clickable
    return (
      <div className={cn("relative", className)} onClick={(e)=>{
        // Click anywhere in the wrapper focuses the input
        const input = (e.currentTarget.querySelector('input') as HTMLInputElement | null)
        if (input) input.focus()
      }}>
        <label htmlFor={inputId} className="mb-1 block text-sm text-muted-foreground">{label}</label>
        <input
          id={inputId}
          ref={ref}
          placeholder={placeholder}
          className={cn(
            "h-10 sm:h-11 w-full rounded-md px-3 pr-10 text-sm sm:text-base focus:outline-none",
            borderless ? "bg-muted/20 border-0 ring-0" : "bg-background border border-input ring-0 focus:border-primary",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        />
        {rightAdornment && (
          <div className="pointer-events-auto absolute right-2 bottom-2.5">
            {rightAdornment}
          </div>
        )}
      </div>
    )
  }
)
NotchedInput.displayName = "NotchedInput"

export default NotchedInput
