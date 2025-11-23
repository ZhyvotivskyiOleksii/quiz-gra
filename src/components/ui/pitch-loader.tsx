"use client";

import * as React from 'react'
import { cn } from '@/lib/utils'

type PitchLoaderProps = {
  size?: number
  className?: string
}

export function PitchLoader({ size = 80, className }: PitchLoaderProps) {
  const ringStyle = (duration: number, reverse = false) => ({
    animation: `spin ${duration}s linear infinite${reverse ? ' reverse' : ''}`,
  })
  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inset-[6px] rounded-full border-[3px] border-transparent border-t-[#ff824c]"
        style={ringStyle(1.8)}
      />
      <span
        className="absolute inset-[14px] rounded-full border-[3px] border-transparent border-r-[#7c3aed]"
        style={ringStyle(2.4, true)}
      />
      <span
        className="absolute inset-[22px] rounded-full border-[3px] border-transparent border-b-[#16c997]"
        style={ringStyle(2.1)}
      />
    </div>
  )
}

type LoaderOverlayProps = {
  show?: boolean
  message?: string
  fullScreen?: boolean
  className?: string
}

export function LoaderOverlay({ show, message, fullScreen = true, className }: LoaderOverlayProps) {
  if (!show) return null
  return (
    <div
      className={cn(
        'z-[1200] pointer-events-none flex items-center justify-center',
        fullScreen ? 'fixed inset-0' : 'absolute inset-0',
        className,
      )}
    >
      <div className="relative flex flex-col items-center gap-4 text-center">
        <PitchLoader size={90} />
        {message ? <p className="text-sm text-white/80 font-semibold tracking-wide">{message}</p> : null}
      </div>
    </div>
  )
}
