import * as React from 'react'
import { cn } from '@/lib/utils'

type TopBarProps = {
  children: React.ReactNode
  className?: string
  heightClassName?: string // allow h-14/h-16 overrides if needed
}

export function TopBar({ children, className, heightClassName }: TopBarProps) {
  return (
    <header className={cn(
      'sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
      className,
    )}>
      <div className={cn('flex items-center gap-4 w-full max-w-[1440px] mx-auto px-[60px]', heightClassName ?? 'h-16')}>
        {children}
      </div>
    </header>
  )
}

export default TopBar
