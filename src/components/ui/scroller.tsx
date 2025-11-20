import * as React from 'react'
import { cn } from '@/lib/utils'

type ScrollerProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical'
}

const Scroller = React.forwardRef<HTMLDivElement, ScrollerProps>(
  ({ className, orientation = 'horizontal', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'relative',
        orientation === 'horizontal' &&
          'overflow-x-auto overflow-y-hidden supports-[scroll-snap-type]:scroll-smooth scroll-p-3 scrollbar-hide',
        orientation === 'vertical' && 'overflow-y-auto overflow-x-hidden scrollbar-hide',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  ),
)
Scroller.displayName = 'Scroller'

export { Scroller }
