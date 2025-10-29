import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Sparkles, Timer } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function PlayPage() {
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
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-headline font-extrabold">Graj</h1>
          <p className="text-sm text-muted-foreground">Wybierz tryb i zacznij quiz</p>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Krótki quiz</CardTitle>
            <CardDescription>6 pytań na szybko</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="#">
                <Sparkles className="mr-2 h-4 w-4" /> Rozpocznij
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Na czas</CardTitle>
            <CardDescription>Sprawdź się pod presją</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="secondary">
              <Timer className="mr-2 h-4 w-4" /> Start
            </Button>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Losowe</CardTitle>
            <CardDescription>Mieszanka kategorii</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline">Zaczynamy</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
