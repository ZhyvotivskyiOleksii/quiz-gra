import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import Link from 'next/link'
import Image from 'next/image'
import { Timer, ChevronRight } from 'lucide-react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function PlayPage() {
  // Load published quizzes for this view
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      } as any,
    }
  )
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id,label,deadline_at,leagues(name,code),quizzes(*)')
    .neq('status','draft')
    .order('deadline_at',{ ascending: true })
    .limit(8)

  function formatTimeLeft(deadline?: string | null) {
    if (!deadline) return null
    try {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) return 'Zakończono'
      const m = Math.floor(diff / 60000)
      const d = Math.floor(m / (60*24))
      const h = Math.floor((m % (60*24)) / 60)
      const mm = m % 60
      if (d > 0) return `${d}d ${h}h ${mm}m`
      if (h > 0) return `${h}h ${mm}m`
      return `${mm}m`
    } catch { return null }
  }

  const items = (rounds || [])
    .filter((r:any) => {
      // must have at least one quiz attached and be within time window
      const hasQuiz = Array.isArray(r.quizzes) && r.quizzes.length > 0
      if (!hasQuiz) return false
      try { return new Date(r.deadline_at).getTime() > Date.now() } catch { return true }
    })

  return (
    <div className="relative mx-auto w-full max-w-[1200px] space-y-6">
      {/* Centered decorative background image */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[340px] z-0">
        <Image
          src="/images/qv-img.svg"
          alt=""
          width={320}
          height={220}
          className="object-contain contrast-125 saturate-125 dark:brightness-150"
          style={{ opacity: 0.3 }}
          priority
        />
      </div>
      <div className="relative z-10 py-1">
        <div>
          <h1 className="font-headline font-extrabold uppercase text-4xl sm:text-5xl bg-clip-text text-transparent bg-gradient-to-b from-yellow-300 via-yellow-300 to-yellow-600 drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]">
            TYPUJ I WYGRYWAJ
          </h1>
          <p className="mt-1 text-2xl sm:text-3xl font-extrabold uppercase text-white drop-shadow">ZA DARMO</p>
        </div>
      </div>

      {/* Удалены старые режимы. Ниже — только опубликованные квизы. */}

      {/* Dyn. quizzes published by admins */}
      {items.length > 0 && (
        <div className="relative z-10 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {items.map((r:any) => {
              const q = r.quizzes?.[0] || {}
              const img = q.image_url || '/images/preview.webp'
              const prize = q.prize
              return (
                <div key={r.id} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#3a0d0d] via-[#5a0f0f] to-[#7a1313] p-0 shadow-xl transition-transform hover:-translate-y-0.5 hover:shadow-2xl">
                  <div className="flex">
                    <div className="relative w-[55%] min-h-[170px] sm:min-h-[210px] overflow-hidden rounded-r-[40px]">
                      <Image src={img} alt="Quiz" fill className="object-cover" />
                      {/* chip */}
                      <div className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] px-2 py-1 flex items-center gap-1">
                        <Timer className="h-3.5 w-3.5" /> Koniec za: {formatTimeLeft(r.deadline_at) || '—'}
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-r from-transparent to-[#7a1313] opacity-95"/>
                    </div>
                    <div className="relative flex-1 p-5 sm:p-6 flex flex-col justify-center items-end text-right">
                      {/* Soft gloss and vignette */}
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_70%_0%,rgba(255,255,255,0.06),transparent_40%)]" />
                      <div className="text-[11px] uppercase tracking-[0.12em] text-white/75">Runda {r.label}</div>
                      <div className="mt-1 text-3xl md:text-4xl font-headline font-extrabold text-white drop-shadow">{r.leagues?.name || 'Wiktoryna'}</div>
                      <div className="mt-2 text-xl sm:text-2xl font-extrabold text-yellow-300 drop-shadow">{typeof prize === 'number' ? prize.toLocaleString('pl-PL') + ' zł' : ''}</div>
                      <div className="mt-1 text-xs text-white/90">{new Date(r.deadline_at).toLocaleString('pl-PL', { month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</div>
                      <div className="mt-4 self-end">
                        {q.id && (
                          <Button asChild className="h-10 rounded-full bg-yellow-400 text-black hover:bg-yellow-300 font-semibold shadow">
                            <Link href={`/app/quizzes/${q.id}/play`}>Zagraj za darmo <ChevronRight className="ml-1 h-4 w-4" /></Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
