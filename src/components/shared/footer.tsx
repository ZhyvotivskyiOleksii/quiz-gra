'use client';
import { Link } from '@/navigation';
import { useTranslations } from 'next-intl';
import { ThemeSwitcher } from './theme-switcher';
import { useIsMobile } from '@/hooks/use-mobile';

export function Footer() {
  const t = useTranslations('Footer');
  const isMobile = useIsMobile();
  return (
    <footer className="w-full shrink-0 border-t mt-12 border-border/50">
        <div className="container flex flex-col gap-4 sm:flex-row py-6 items-center max-w-[1440px] mx-auto px-10">
            <p className="text-xs text-muted-foreground order-2 sm:order-1">{t('copyright')}</p>
            {isMobile && <div className="order-1 sm:order-2"><ThemeSwitcher /></div>}
            <nav className="sm:ml-auto flex gap-4 sm:gap-6 order-3 sm:order-3">
              <a href="#" className="text-xs hover:underline underline-offset-4">
                {t('terms')}
              </a>
              <a href="#" className="text-xs hover:underline underline-offset-4">
                {t('privacy')}
              </a>
            </nav>
        </div>
      </footer>
  );
}
