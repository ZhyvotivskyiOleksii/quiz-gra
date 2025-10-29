'use client';
import { ThemeSwitcher } from './theme-switcher';
import { useIsMobile } from '@/hooks/use-mobile';

export function Footer() {
  const isMobile = useIsMobile();
  return (
    <footer className="w-full shrink-0 border-t mt-12 border-border/50">
        <div className="container flex flex-col gap-4 sm:flex-row py-6 items-center max-w-[1440px] mx-auto px-10">
            <p className="text-xs text-muted-foreground order-2 sm:order-1">© 2024 QuizTime. Wszelkie prawa zastrzeżone.</p>
            {isMobile && <div className="order-1 sm:order-2"><ThemeSwitcher /></div>}
            <nav className="sm:ml-auto flex gap-4 sm:gap-6 order-3 sm:order-3">
              <a href="#" className="text-xs hover:underline underline-offset-4">
                Regulamin
              </a>
              <a href="#" className="text-xs hover:underline underline-offset-4">
                Polityka Prywatności
              </a>
            </nav>
        </div>
      </footer>
  );
}
