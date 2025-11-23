import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Flame, Users } from 'lucide-react'

const faqEntries = [
  {
    q: 'Dlaczego nagrody zaczynają się od 5 poprawnych?',
    a: 'Bo chcemy nagradzać pełne kupony (3 historia + min. 2 typy na przyszłość). To sprawiedliwy balans między rozgrzewką a prawdziwym wyzwaniem.',
  },
  {
    q: 'Co, jeśli kilka osób zdobędzie tyle samo trafień?',
    a: 'Dzielimy pulę po równo. Przykład: 2 000 zł za 5 poprawnych i czterech zwycięzców oznacza po 500 zł dla każdego.',
  },
  {
    q: 'Jak długo czekam na rozliczenie bonusu?',
    a: 'Bonus naliczamy, gdy wszystkie mecze z rundy mają finalny wynik. Zwykle chwilę po końcowym gwizdku ostatniego spotkania.',
  },
  {
    q: 'Co oznacza „pula 1:2”?',
    a: 'To domyślna proporcja – ⅓ puli dla progu 5, ⅔ puli dla progu 6. Aktualny podział zawsze widać na karcie SuperGame.',
  },
  {
    q: 'Czy mogę wygrać kilka progów na raz?',
    a: 'Oczywiście. Trafiając 6/6, łapiesz nagrody za oba progi (5 oraz 6) – dzielone po równo między zwycięzców.',
  },
]

export default async function BonusInfoPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold">Bonusy — zasady</h1>
          <p className="text-sm text-muted-foreground">
            Krótki przewodnik po tym jak naliczamy nagrody i jak dzielimy pule na zwycięzców.
          </p>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-white/5 p-6 shadow-[0_40px_90px_rgba(5,4,18,0.45)] backdrop-blur">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.4em] text-white/60">FAQ</p>
            <h2 className="text-4xl font-headline font-extrabold text-white">Jak działają bonusy?</h2>
            <p className="text-sm text-white/75">
              Jeden quiz = 3 pytania historyczne + 3 pytania o przyszłość. Nagrody wypłacamy dopiero przy 5 lub 6 trafieniach, dlatego warto
              śledzić typy aż do końca.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">5 poprawnych</p>
                <p className="text-lg font-semibold text-white">mniejsza nagroda</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">6 poprawnych</p>
                <p className="text-lg font-semibold text-white">pełna nagroda</p>
              </div>
            </div>
          </div>
          <div className="relative flex items-end justify-center">
            <Image
              src="/icon/info.webp"
              alt="Bonus info"
              width={620}
              height={620}
              className="h-auto w-full max-w-[420px] object-contain drop-shadow-[0_40px_90px_rgba(0,0,0,0.55)]"
              priority={false}
            />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr),minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <Card className="border border-white/10 bg-black/25/80 shadow-[0_30px_80px_rgba(3,2,12,0.55)]">
            <CardHeader>
              <CardTitle className="text-3xl font-headline text-white">FAQ</CardTitle>
              <CardDescription className="text-white/75">Najczęściej zadawane pytania</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="space-y-3">
                {faqEntries.map((item, idx) => (
                  <AccordionItem
                    key={item.q}
                    value={`item-${idx}`}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                  >
                    <AccordionTrigger className="px-4 py-3 text-left text-white hover:bg-white/5">{item.q}</AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm text-white/80">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle>Jak dzielimy pulę?</CardTitle>
              <CardDescription>Cała nagroda przypisana do quizu trafia do graczy z progów 5 i 6.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-xl border border-white/10 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-pink-500/10 px-4 py-3 text-white/90">
                Pula domyślnie dzieli się w stosunku 1:2 pomiędzy nagrodę za 5 oraz 6 poprawnych. W każdej rundzie komunikujemy aktualny podział
                w karcie SuperGame, a wypłaty zawsze trafiają tylko do tych dwóch progów.
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-card/70 px-3 py-2">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">Przykład</div>
                  <div className="text-lg font-bold text-white">Pula 6 000 zł</div>
                  <p className="text-xs text-white/70">
                    5 poprawnych → 2 000 zł <br /> 6 poprawnych → 4 000 zł
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-card/40 px-3 py-2">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/60">Gdy kilku graczy ma tyle samo trafień</div>
                  <p className="text-xs text-white/70">
                    Dzielimy pulę progu po równo. Np. 4 osoby z 6 poprawnymi otrzymają po 1 000 zł każda.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle>Jak zdobywasz bonus?</CardTitle>
              <CardDescription>Każda runda składa się z 3 pytań historycznych i 3 pytań o przyszłość.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Flame className="h-4 w-4 text-primary" />
                  Minimalny próg nagrody = 5 poprawnych odpowiedzi
                </h3>
                <p className="mt-2">
                  Czemu tak? Pytania historyczne traktujemy jako rozgrzewkę — Prawdziwą przewagę dają typy na przyszłość.
                  Aby zostać nagrodzonym, musisz zaliczyć cały blok historii (3 poprawne) oraz co najmniej 2 trafienia w pytaniach o przyszłość.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="rounded-lg bg-card/60 px-3 py-2">
                  <span className="font-semibold text-white">5 poprawnych</span> — mniejsza nagroda (3 historia + 2 przyszłość)
                </li>
                <li className="rounded-lg bg-card/60 px-3 py-2">
                  <span className="font-semibold text-white">6 poprawnych</span> — główna nagroda (perfekcyjny kupon)
                </li>
                <li className="rounded-lg bg-card/30 px-3 py-2 text-muted-foreground">
                  3 lub 4 poprawne — brak nagrody, ale wciąż zbierasz punkty do rankingu.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-xl shadow-black/10">
            <CardHeader>
              <CardTitle>FAQ & wskazówki</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-white">Czy liczy się kolejność odpowiedzi?</p>
                <p>Nie. Ważny jest wyłącznie wynik końcowy (5 lub 6 trafień).</p>
              </div>
              <div>
                <p className="font-semibold text-white">Co jeśli quiz zostanie anulowany?</p>
                <p>W przypadku odwołanego meczu lub problemu z danymi — nagrody są wstrzymywane, a runda oznaczona jako „weryfikacja”.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-card/60 px-3 py-2 text-white/80">
                Tip: sprawdzaj zakładkę SuperGame — tam widać pozostały czas do zakończenia typowania oraz aktualne pule.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
