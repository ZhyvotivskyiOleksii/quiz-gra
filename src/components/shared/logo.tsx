import Link from 'next/link';
import { cn } from '@/lib/utils';
import * as React from 'react';

function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  // Uses currentColor for stroke so it adapts to theme (white/black)
  // and hsl(var(--primary)) for the red accent.
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
    >
      {/* Outer ring (clock) */}
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {/* Clock hand inside circle (no overflow) */}
      <path d="M12 8.6 V 12.0 L 14.4 14.0" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Decorative tail kept inside circle boundary */}
      <path d="M14.8 14.8 L 16.2 16.2" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />

      {/* Polish-style flag badge (slightly larger and a bit more to the left) */}
      <g transform="translate(3,0.6)">
        <rect x="0" y="0" width="8" height="4.6" rx="0.7" fill="#ffffff" stroke="currentColor" strokeOpacity="0.15"/>
        <rect x="0" y="2.4" width="8" height="2.2" rx="0" fill="hsl(var(--primary))"/>
      </g>
    </svg>
  );
}

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 font-headline', className)}>
      <LogoMark />
      <span className="text-base sm:text-lg font-extrabold tracking-wide">
        <span className="text-foreground">Quiz</span>
        <span className="text-primary">Time</span>
      </span>
    </Link>
  );
}
