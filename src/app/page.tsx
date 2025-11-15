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
      <section className="relative w-full min-h-[calc(100dvh-64px)] flex flex-col overflow-hidden">
        {/* Фон: героиня справа как декоративное изображение (планшеты и десктоп) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden lg:block" style={{ width: 'clamp(30vw, 40vw, 45vw)' }}>
          <div className="relative h-full w-full">
            <Image
              src="/images/hero-img.svg"
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 40vw, 45vw"
              className="object-contain object-right-bottom"
            />
          </div>
        </div>

        {/* Контент */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-4 sm:px-5 md:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-4 sm:pt-5 md:pt-6 lg:pt-8 pb-6 sm:pb-8 md:pb-10 lg:pb-14">
          {/* Баннеры */}
          <div className="max-[360px]:hidden mb-3 sm:mb-4 md:mb-5 lg:mb-6">
            <HeroBanners />
          </div>

          {/* Основной контент - резиновая сетка */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 xl:gap-8 items-center lg:items-start text-center lg:text-left">
            {/* Левая колонка с текстом */}
            <div className="w-full lg:col-span-7 xl:col-span-6 flex flex-col items-center lg:items-start">
              {/* Бейдж */}
              <div className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 sm:px-3 md:px-3.5 py-0.5 sm:py-1 text-primary text-[10px] sm:text-xs md:text-sm tracking-wide mb-2.5 sm:mb-3 md:mb-4">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
                <span className="whitespace-nowrap">Predykcje na żywo i quizy</span>
              </div>

              {/* Заголовок - резиновый размер */}
              <h1 className="text-[clamp(1.5rem,4vw,4.5rem)] font-extrabold tracking-tight font-headline leading-[1.1] sm:leading-tight mb-2.5 sm:mb-3 md:mb-4 lg:mb-5 w-full max-w-4xl">
                Typuj wyniki. Zdobywaj punkty. Wspinaj się w rankingu.
              </h1>

              {/* Описание - резиновый размер */}
              <p className="text-foreground/80 text-[clamp(0.75rem,1.5vw,1.25rem)] leading-relaxed mb-4 sm:mb-5 md:mb-6 lg:mb-8 xl:mb-10 w-full max-w-2xl">
                Dołącz do gry łączącej klimat zakładów sportowych z wiedzą i przewidywaniem. Odpowiadaj na pytania, typuj wydarzenia i zgarniaj nagrody.
              </p>

              {/* Кнопка для планшетов и десктопа */}
              <div className="hidden lg:flex">
                {isAuthed ? (
                  <Button
                    asChild
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 text-sm md:text-base h-11 md:h-12 px-6 md:px-8"
                  >
                    <Link href="/app" prefetch={false}>Wejdź do aplikacji</Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 text-sm md:text-base h-11 md:h-12 px-6 md:px-8"
                  >
                    <Link href="/?auth=register">Zacznij grać</Link>
                  </Button>
                )}
              </div>
            </div>

            {/* Правая колонка: изображение на мобилке/планшете, пусто на десктопе */}
            <div className="w-full lg:col-span-5 xl:col-span-6 flex flex-col items-center lg:items-end">
              {/* Мобильная и планшетная версия: изображение + кнопка */}
              <div className="lg:hidden w-full flex flex-col items-center">
                <div className="relative w-full max-w-xs sm:max-w-sm h-60 sm:h-72 mb-4 sm:mb-5">
                  <Image
                    src="/images/hero-img.svg"
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 0px"
                    className="object-contain object-center"
                    priority
                  />
                </div>
                {isAuthed ? (
                  <div className="-mt-4 sm:-mt-5 w-full flex justify-center">
                    <Button
                      asChild
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 text-sm sm:text-base h-10 sm:h-11 md:h-12 px-10 sm:px-12 md:px-14 min-w-[260px] sm:min-w-[280px]"
                    >
                      <Link href="/app" prefetch={false}>Wejdź do aplikacji</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="-mt-4 sm:-mt-5 w-full flex justify-center">
                    <Button
                      asChild
                      size="lg"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-primary/25 text-sm sm:text-base h-10 sm:h-11 md:h-12 px-10 sm:px-12 md:px-14 min-w-[260px] sm:min-w-[280px]"
                    >
                      <Link href="/?auth=register">Zacznij grać</Link>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Мягкий туман снизу для плавного перехода */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 sm:h-20 md:h-32 lg:h-40 bg-gradient-to-b from-transparent to-[hsl(var(--background))]" />
      </section>

      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16">
          <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 text-center px-2 sm:px-0">
            <div className="space-y-2 sm:space-y-3">
              <div className="inline-block rounded-lg bg-muted px-2.5 sm:px-3 py-1 text-xs sm:text-sm">Kluczowe Funkcje</div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tighter font-headline text-primary leading-tight px-2 sm:px-0">
                Wszystko, czego potrzebujesz do dobrej zabawy
              </h2>
              <p className="max-w-[900px] mx-auto text-muted-foreground text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed px-2 sm:px-0">
                Nasza platforma oferuje unikalne połączenie quizów historycznych i predykcyjnych, rankingi w czasie rzeczywistym i wiele więcej.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-6 sm:gap-8 sm:grid-cols-2 md:gap-10 lg:gap-12 lg:grid-cols-3 mt-8 sm:mt-10 md:mt-12">
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
          <CarouselItem key={id} className="basis-full sm:basis-[85%] md:basis-[60%] lg:basis-1/3">
            {/* Real banner: image background without red tint */}
            <div className="relative h-[140px] sm:h-[150px] md:h-[170px] lg:h-[190px] overflow-hidden rounded-xl sm:rounded-2xl shadow-lg">
              <Image src={image} alt={title} fill className="object-cover" sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" />
              {/* Only dark vignette for readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/5" />
              <div className="absolute inset-0 ring-1 ring-black/10 dark:ring-white/15 pointer-events-none rounded-xl sm:rounded-2xl" />

              <div className="relative z-10 h-full flex flex-col justify-between p-4 sm:p-5 md:p-6 text-white">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-white/20 bg-black/40 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs">
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    {badge}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3 sm:gap-4">
                  <div className="max-w-[65%] sm:max-w-[70%] flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg md:text-xl font-extrabold leading-tight drop-shadow-sm line-clamp-2">{title}</h3>
                    <p className="text-white/85 text-[11px] sm:text-xs md:text-sm mt-1 drop-shadow-sm line-clamp-2">{subtitle}</p>
                  </div>
                  <div className="shrink-0 self-end">
                    <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] sm:text-xs h-7 sm:h-8 px-3 sm:px-4 whitespace-nowrap">
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
