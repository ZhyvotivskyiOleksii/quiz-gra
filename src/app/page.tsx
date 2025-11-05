'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, BrainCircuit, History, Trophy, Zap, Gift } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import React from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel'

export default function Home() {
  const router = useRouter()
  const [isAuthed, setIsAuthed] = React.useState(false)

  React.useEffect(() => {
    ;(async () => {
      try {
        const supabase = getSupabase()
        const { data } = await supabase.auth.getSession()
        setIsAuthed(!!data.session)
      } catch {}
    })()
  }, [])

  // Перенаправление на /app выполняют формы входа/регистрации и OAuth callback.
  // На главной странице слушать onAuthStateChange и пинговать сервер не нужно — меньше лишних запросов.

  return (
    <>
      <section className="relative w-full min-h-[72vh] flex items-center overflow-hidden">
        {/* Dark theme background image + vignette; keep light clean */}
        <div className="pointer-events-none absolute inset-0 z-0 opacity-30 mix-blend-overlay hidden dark:block">
          <Image src="/images/preview.webp" alt="Background preview" fill priority className="object-cover" />
        </div>
        <div className="absolute inset-0 z-0 hidden dark:block bg-gradient-to-b from-black/70 via-black/60 to-black/80" />

        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-15 py-10 md:py-14 animate-fade-in-up text-foreground">
          {/* Top swipeable banners - sportsbook style */}
          <HeroBanners />

          <div className="grid grid-cols-1 md:grid-cols-12 items-start gap-8 mt-8 md:mt-12">
            <div className="text-left md:col-span-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary text-xs tracking-wide">
                <Zap className="w-3.5 h-3.5" />
                Predykcje na żywo i quizy
              </div>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-6xl xl:text-7xl/none font-headline">
                Typuj wyniki. Zdobywaj punkty. Wspinaj się w rankingu.
              </h1>
              <p className="max-w-[800px] text-foreground/80 md:text-xl mt-4">
                Dołącz do gry łączącej klimat zakładów sportowych z wiedzą i przewidywaniem. Odpowiadaj na pytania, typuj wydarzenia i zgarniaj nagrody.
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row mt-8 justify-start">
                {isAuthed ? (
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25">
                    <Link href="/app" prefetch={false}>Wejdź do aplikacji</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25">
                      <Link href="/?auth=register">Zacznij grać</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="bg-transparent border-border text-foreground hover:bg-foreground hover:text-background transition-colors duration-300">
                      <Link href="/?auth=login">Zaloguj się</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div aria-hidden className="hidden md:block md:col-span-4" />
          </div>
        </div>
        {/* Smooth fade to next section */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 md:h-28 bg-gradient-to-b from-transparent to-[hsl(var(--background))]" />
      </section>

      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-15">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">Kluczowe Funkcje</div>
              <h2 className="text-3xl font-extrabold tracking-tighter sm:text-5xl font-headline text-primary">Wszystko, czego potrzebujesz do dobrej zabawy</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Nasza platforma oferuje unikalne połączenie quizów historycznych i predykcyjnych, rankingi w czasie rzeczywistym i wiele więcej.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 mt-12">
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                <History className="w-8 h-8 text-primary" />
                <CardTitle>Pytania Historyczne</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Sprawdź swoją wiedzę z różnych dziedzin. Odpowiedzi są znane, liczy się szybkość i precyzja.</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                <BrainCircuit className="w-8 h-8 text-primary" />
                <CardTitle>Pytania Predykcyjne</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Przewiduj wyniki przyszłych wydarzeń. Twoja odpowiedź zostanie zweryfikowana, gdy wydarzenie się zakończy.</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <CardTitle>Rozliczenia i Rankingi</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Śledź swoje postępy, zdobywaj punkty za poprawne odpowiedzi i rywalizuj z innymi graczami o miano najlepszego.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  )
}

// HeroBanners component kept in this file for simplicity
function HeroBanners() {
  const [api, setApi] = React.useState<CarouselApi | null>(null)

  React.useEffect(() => {
    if (!api) return
    const id = setInterval(() => {
      try {
        api.scrollNext()
      } catch {}
    }, 4500)

    return () => clearInterval(id)
  }, [api])

  const slides = [
    {
      id: 'boost',
      badge: 'Nowość',
      title: 'Weekendowy Boost +50%',
      subtitle: 'Więcej punktów za typy sportowe w weekendy.',
      image: '/baner/helo.png',
      icon: Trophy,
    },
    {
      id: 'bonus',
      badge: 'Bonus',
      title: '100 monet na start',
      subtitle: 'Zarejestruj się i odbierz powitalny bonus.',
      image:
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1400&auto=format&fit=crop',
      icon: Gift,
    },
    {
      id: 'live',
      badge: 'Na żywo',
      title: 'Mecz dnia: specjalne pytania',
      subtitle: 'Typuj na żywo i zgarniaj ekstra punkty.',
      image:
        'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=1400&auto=format&fit=crop',
      icon: Zap,
    },
  ]

  return (
    <Carousel
      opts={{ align: 'start', loop: true }}
      setApi={setApi}
      className="relative"
      aria-label="Promocyjne banery"
    >
      <CarouselContent>
        {slides.map(({ id, badge, title, subtitle, image, icon: Icon }) => (
          <CarouselItem key={id} className="md:basis-[60%] lg:basis-1/3">
            {/* Real banner: image background without red tint */}
            <div className="relative h-[160px] md:h-[180px] lg:h-[200px] overflow-hidden rounded-2xl shadow-lg">
              <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
              {/* Only dark vignette for readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/5" />
              <div className="absolute inset-0 ring-1 ring-black/10 dark:ring-white/15 pointer-events-none rounded-2xl" />

              <div className="relative z-10 h-full flex flex-col justify-between p-5 md:p-6 text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-xs">
                    <Icon className="h-3.5 w-3.5" />
                    {badge}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div className="max-w-[70%]">
                    <h3 className="text-lg md:text-xl font-extrabold leading-tight drop-shadow-sm">{title}</h3>
                    <p className="text-white/85 text-xs md:text-sm mt-1 drop-shadow-sm">{subtitle}</p>
                  </div>
                  <div className="shrink-0 self-end">
                    <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                      <Link href="/?auth=register">Zagraj teraz</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-2 top-1/2 -translate-y-1/2 border-border bg-background/70 backdrop-blur text-foreground hover:bg-background/90 dark:bg-black/40 dark:text-white" />
      <CarouselNext className="right-2 top-1/2 -translate-y-1/2 border-border bg-background/70 backdrop-blur text-foreground hover:bg-background/90 dark:bg-black/40 dark:text-white" />
    </Carousel>
  )
}
