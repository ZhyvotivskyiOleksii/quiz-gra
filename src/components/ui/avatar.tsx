"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

// Cache for failed URLs to avoid repeated requests
const failedUrls = new Set<string>()

// Check if URL is from Google (rate-limited)
const isGoogleAvatarUrl = (url: string) => 
  url?.includes('googleusercontent.com') || url?.includes('ggpht.com')

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => {
  const [hasError, setHasError] = React.useState(false)
  
  // Reset error state when src changes
  React.useEffect(() => {
    if (src && failedUrls.has(src)) {
      setHasError(true)
    } else {
      setHasError(false)
    }
  }, [src])
  
  // Skip Google avatar URLs entirely - they get rate-limited (429)
  // Also skip if already failed or no src
  if (!src || hasError || isGoogleAvatarUrl(src) || failedUrls.has(src)) {
    return null // Let AvatarFallback show
  }
  
  return (
    <AvatarPrimitive.Image
      ref={ref}
      src={src}
      className={cn("aspect-square h-full w-full", className)}
      onLoadingStatusChange={(status) => {
        if (status === 'error' && src) {
          failedUrls.add(src)
          setHasError(true)
        }
      }}
      {...props}
    />
  )
})
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
