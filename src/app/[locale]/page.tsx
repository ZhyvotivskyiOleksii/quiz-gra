'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, BrainCircuit, History } from 'lucide-react';
import {useTranslations} from 'next-intl';
import { Link } from '@/navigation';
import Image from 'next/image';

export default function Home() {
  const t = useTranslations('Hero');
  const tFeatures = useTranslations('Features');

  return (
    <>
      <section className="relative w-full h-screen flex items-center text-white overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/preview.webp"
            alt="Background preview"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 md:px-10 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-6">
            <div className="text-left md:col-span-8">
              <h1 className="uppercase text-4xl font-extrabold tracking-tighter sm:text-6xl xl:text-7xl/none font-headline text-white [text-shadow:_0_2px_4px_rgb(0_0_0_/_40%)]">
                {t('title')}
              </h1>
              <p className="max-w-[800px] text-neutral-200 md:text-xl mt-4 [text-shadow:_0_1px_2px_rgb(0_0_0_/_30%)]">
                {t('description')}
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row mt-8 justify-start">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300">
                  <Link href="/register">
                    {t('cta_start')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="bg-transparent border-white text-white hover:bg-white hover:text-black transition-colors duration-300">
                  <Link href="/login">
                    {t('cta_login')}
                  </Link>
                </Button>
              </div>
            </div>
            <div aria-hidden className="hidden md:block md:col-span-4" />
          </div>
        </div>
      </section>

      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">{tFeatures('subtitle')}</div>
              <h2 className="text-3xl font-extrabold tracking-tighter sm:text-5xl font-headline text-primary">{tFeatures('title')}</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                {tFeatures('description')}
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 mt-12">
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                <History className="w-8 h-8 text-primary" />
                <CardTitle>{tFeatures('historical_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tFeatures('historical_desc')}</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                  <BrainCircuit className="w-8 h-8 text-primary"/>
                <CardTitle>{tFeatures('predictive_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tFeatures('predictive_desc')}</p>
              </CardContent>
            </Card>
            <Card className="hover:shadow-lg transition-shadow duration-300 border-0 dark:bg-gradient-to-b from-[#353535] to-[#222222]">
              <CardHeader className="flex flex-row items-center gap-4">
                <CheckCircle className="w-8 h-8 text-primary" />
                <CardTitle>{tFeatures('leaderboards_title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{tFeatures('leaderboards_desc')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
