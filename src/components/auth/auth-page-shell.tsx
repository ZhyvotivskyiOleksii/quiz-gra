import Image from 'next/image'
import * as React from 'react'
import { cn } from '@/lib/utils'

type AuthPageShellProps = {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function AuthPageShell({ title, subtitle, children, footer, className }: AuthPageShellProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#030316] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_50%),radial-gradient(circle_at_bottom,rgba(222,72,255,0.08),transparent_55%)]" />
        <Image
          src="/images/hero-img.svg"
          alt=""
          width={640}
          height={640}
          priority
          className="absolute bottom-0 right-0 w-[min(520px,45vw)] opacity-80 drop-shadow-[0_35px_90px_rgba(0,0,0,0.55)]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#030316]/30 via-transparent to-[#0b0f29]/50" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
        <div className={cn('w-full max-w-[480px] rounded-[28px] border border-white/10 bg-[rgba(6,8,22,0.92)] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur', className)}>
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-[0.45em] text-white/60">QuizTime</p>
            <h1 className="mt-2 font-headline text-3xl font-extrabold uppercase tracking-wide">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-white/70">{subtitle}</p>}
          </div>
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-white/80">{footer}</div> : null}
      </div>
    </div>
  )
}
