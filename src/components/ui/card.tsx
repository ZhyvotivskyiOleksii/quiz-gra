import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Elevated card. Stronger depth on light theme, softer on dark.
      "relative rounded-2xl bg-card text-card-foreground transition-shadow",
      // Light: layered shadow for volume; Dark: softer ambient shadow
      "shadow-[0_14px_30px_-14px_rgba(0,0,0,0.28),0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_48px_-16px_rgba(0,0,0,0.32),0_6px_16px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] dark:hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]",
      // Subtle inner hairline on light to separate from background
      "before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:pointer-events-none before:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:before:shadow-none",
      // Top highlight for glossy edge (very subtle)
      "after:content-[''] after:absolute after:inset-x-0 after:top-0 after:h-px after:rounded-t-[inherit] after:bg-gradient-to-b after:from-white/60 after:to-transparent dark:after:from-white/10",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
