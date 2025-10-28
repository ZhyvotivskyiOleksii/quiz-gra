'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DE, PL } from 'country-flag-icons/react/3x2'
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { useParams } from 'next/navigation';


export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const changeLocale = (nextLocale: string) => {
    router.replace({pathname}, {locale: nextLocale});
  }

  const CurrentFlag = locale === 'de' ? DE : PL;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 rounded-full border-border/50 bg-secondary hover:bg-secondary/80 px-4 py-2 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none">
          <CurrentFlag title={locale} className="h-5 w-5 rounded-full" />
          <span className="font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card border-border">
        <DropdownMenuItem onClick={() => changeLocale('pl')} className="focus:bg-sidebar-accent focus:outline-none">
            <PL title="Polski" className="h-4 w-4 mr-2" />
            Polski
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeLocale('de')} className="focus:bg-sidebar-accent focus:outline-none">
            <DE title="Deutsch" className="h-4 w-4 mr-2" />
            Deutsch
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
