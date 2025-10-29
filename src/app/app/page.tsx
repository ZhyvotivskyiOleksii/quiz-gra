import { Button } from "@/components/ui/button";
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BrainCircuit, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import Image from 'next/image'
// Direct panel page (no auth gating)

export default async function AppDashboard() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* Nagłówek i szybkie akcje */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold">Panel</h1>
          <p className="text-sm text-muted-foreground">Przegląd Twojej aktywności w QuizTime</p>
        </div>
        <Button size="lg" className="shadow-sm" asChild>
          <Link href="/app/play">Rozpocznij szybki quiz <ArrowRight className="ml-2 h-5 w-5" /></Link>
        </Button>
      </div>

      {/* Statystyki */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden shadow-xl shadow-black/10 transition-shadow hover:shadow-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/10">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2">
            <Image src="/panel/1.png" alt="Punkty" fill className="object-contain object-right opacity-95" sizes="(min-width:1024px) 50vw, 50vw" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zdobyte punkty</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1 240</div>
            <p className="text-xs text-muted-foreground">+120 w ostatnim tygodniu</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden shadow-xl shadow-black/10 transition-shadow hover:shadow-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/10">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2">
            <Image src="/panel/2.png" alt="Próby" fill className="object-contain object-right opacity-95" sizes="(min-width:1024px) 50vw, 50vw" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Podejścia do quizów</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">36</div>
            <p className="text-xs text-muted-foreground">3 nowe w tym tygodniu</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden shadow-xl shadow-black/10 transition-shadow hover:shadow-2xl bg-gradient-to-br from-white/5 to-transparent dark:from-white/10">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2">
            <Image src="/panel/3.png" alt="Ranking" fill className="object-contain object-right opacity-95" sizes="(min-width:1024px) 50vw, 50vw" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pozycja w rankingu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">#12</div>
            <p className="text-xs text-muted-foreground">wśród znajomych i ogółu</p>
          </CardContent>
        </Card>
      </div>

      {/* Główne bloki: ostatnie i zaplanowane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Ostatnie gry/podejścia */}
        <Card className="lg:col-span-2 shadow-xl shadow-black/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ostatnie podejścia</CardTitle>
              <CardDescription>Twoje ostatnie odpowiedzi i status weryfikacji</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1,2,3,4].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-card px-4 py-3 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">Pytanie #{100 + i}</div>
                      <div className="text-xs text-muted-foreground">Historyczne • 18.10.2024</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">4/6</span>
                    <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-1">zaliczono</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dziś/plan na tydzień */}
        <Card className="shadow-xl shadow-black/10">
          <CardHeader>
            <CardTitle>Na dziś</CardTitle>
            <CardDescription>Co możesz zrobić teraz</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Przejdź szybki quiz z 6 pytań
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <CalendarDays className="h-4 w-4 text-primary" />
              Dodaj przypomnienie o codziennym wyzwaniu
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 shadow-md shadow-black/10 transition-shadow hover:shadow-lg">
              <Clock className="h-4 w-4 text-primary" />
              Zobacz prognozowane pytania oczekujące na wynik
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// (images overlaid on the right via absolute containers in each card)
export const dynamic = 'force-dynamic'
export const revalidate = 0
