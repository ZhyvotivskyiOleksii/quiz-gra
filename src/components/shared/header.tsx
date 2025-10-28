'use client';

import { Logo } from '@/components/shared/logo';
import { LanguageSwitcher } from './language-switcher';
import { useTranslations } from 'next-intl';
import { User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoginForm } from '../auth/login-form';
import { RegisterForm } from '../auth/register-form';
import * as React from 'react';
import { Button } from '../ui/button';
import { ThemeSwitcher } from './theme-switcher';
import { useIsMobile } from '@/hooks/use-mobile';

export function Header() {
  const t = useTranslations('Header');
  const tLogin = useTranslations('Login');
  const tRegister = useTranslations('Register');
  const [open, setOpen] = React.useState(false);
  const [authView, setAuthView] = React.useState('login');
  const isMobile = useIsMobile();

  const handleSuccess = () => {
    setOpen(false);
    // Reset to login view after closing
    setTimeout(() => setAuthView('login'), 300);
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center max-w-[1440px] mx-auto px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            {!isMobile && <ThemeSwitcher />}
            <LanguageSwitcher />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button className="flex flex-col items-center justify-center text-xs font-medium text-foreground hover:text-primary transition-colors focus:outline-none">
                  <User className="h-6 w-6" />
                  <span>{t('login')}</span>
                </button>
              </DialogTrigger>
              <DialogContent
                className="left-0 top-0 h-screen w-screen translate-x-0 translate-y-0 rounded-none p-6 overflow-y-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle className="text-2xl font-extrabold uppercase">
                    {authView === 'login' ? tLogin('title') : tRegister('title')}
                  </DialogTitle>
                  {authView === 'register' && <DialogDescription>
                    {tRegister('description')}
                  </DialogDescription>}
                </DialogHeader>
                
                {authView === 'login' ? (
                  <LoginForm onSuccess={handleSuccess} onSwitchToRegister={() => setAuthView('register')} />
                ) : (
                  <>
                    <RegisterForm onSuccess={() => setAuthView('login')} />
                    <Button
                      variant="secondary"
                      className="mt-2 bg-secondary/60 hover:bg-secondary/80"
                      onClick={() => setAuthView('login')}
                    >
                      {tRegister('switch_to_login')}
                    </Button>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </nav>
        </div>
      </div>
    </header>
  );
}
