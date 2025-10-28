'use client';

import { useRouter } from '@/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from '@/components/ui/form';
// Input kept for other components; not used here after NotchedInput migration
import NotchedInput from '@/components/ui/notched-input';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, Smartphone } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Link } from '@/navigation';
import { Separator } from '../ui/separator';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';
import { getSupabase } from '@/lib/supabaseClient';

type LoginFormProps = {
  onSuccess?: () => void;
  onSwitchToRegister?: () => void;
};

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isPhoneLogin, setIsPhoneLogin] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpPhone, setOtpPhone] = React.useState('');
  const [otpCode, setOtpCode] = React.useState('');
  const t = useTranslations('LoginForm');

  const emailSchema = z.object({
    email: z.string().min(1, t('validation.email_required')).email({ message: t('validation.email_invalid') }),
    password: z.string().min(1, { message: t('validation.password_required') }),
    rememberMe: z.boolean().default(false),
    ageConfirmation: z.boolean().refine(val => val === true, {
      message: t('validation.age_confirmation_required'),
    }),
    marketingConsent: z.boolean().default(false),
  });

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '', rememberMe: false, ageConfirmation: false, marketingConsent: false },
    mode: 'onBlur',
  });

  function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    setIsLoading(true);
    console.log(values);
    // Mock login logic
    setTimeout(() => {
      if (values.email === 'admin@example.com') {
        router.push(`/admin`);
      } else {
        router.push(`/app`);
      }
      toast({ title: t('toast_success') });
      setIsLoading(false);
      onSuccess?.();
    }, 1000);
  }
  
  async function sendOtp() {
    try {
      setIsLoading(true)
      const phone = otpPhone.startsWith('+') ? otpPhone : `+${otpPhone}`
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) throw error
      setOtpSent(true)
      toast({ title: t('otp_sent_toast') })
    } catch (err: any) {
      toast({ title: 'SMS error', description: err?.message ?? 'Unknown error', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyOtp() {
    try {
      setIsLoading(true)
      const phone = otpPhone.startsWith('+') ? otpPhone : `+${otpPhone}`
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: otpCode, type: 'sms' })
      if (error) throw error
      toast({ title: t('toast_success') })
      router.push(`/app`)
      onSuccess?.()
    } catch (err: any) {
      toast({ title: t('otp_invalid_toast'), description: err?.message ?? 'Invalid code', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }
  
  if (isPhoneLogin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('phone_login_title')}</h3>
          <Button variant="ghost" type="button" onClick={() => setIsPhoneLogin(false)}>{t('back_to_email')}</Button>
        </div>
        <div className="space-y-3">
          <NotchedInput
            type="tel"
            label={t('phone_label')}
            value={otpPhone}
            onChange={(e) => setOtpPhone(e.target.value)}
            autoComplete="tel"
          />
          {otpSent && (
            <NotchedInput
              type="text"
              label={t('otp_code_label')}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          )}
          {!otpSent ? (
            <Button className="w-full h-12 text-base font-bold" onClick={sendOtp} disabled={isLoading || !otpPhone}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('send_code_button')}
            </Button>
          ) : (
            <Button className="w-full h-12 text-base font-bold" onClick={verifyOtp} disabled={isLoading || !otpCode}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('verify_code_button')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <NotchedInput
                  type="email"
                  autoComplete="email"
                  {...field}
                  error={!!fieldState.error}
                  label={t('email_label')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <NotchedInput
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...field}
                  error={!!fieldState.error}
                  label={t('password_label')}
                  rightAdornment={
                    <Button
                      type="button"
                      aria-label={showPassword ? t('password_label') + ' hide' : t('password_label') + ' show'}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  }
                />
              </FormControl>
              {fieldState.error && <FormMessage />}
            </FormItem>
          )}
        />

        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                    <Switch
                        id="rememberMe"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                </FormControl>
                <Label htmlFor="rememberMe" className="font-normal pointer-events-auto">{t('remember_me_label')}</Label>
              </FormItem>
            )}
          />
          <a href="#" className="text-sm text-primary hover:underline">{t('forgot_password_link')}</a>
        </div>
        
        <div className="space-y-4 pt-4">
          <FormField
            control={form.control}
            name="ageConfirmation"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">
                    {t('age_confirmation_label_part1')} <a href="#" className="underline">{t('age_confirmation_link')}</a>.
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="marketingConsent"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">
                      {t('marketing_consent_label')}
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-3">
            <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('login_button')}
            </Button>
            <Button type="button" variant="secondary" className="w-full h-12 text-base font-bold" onClick={onSwitchToRegister}>
                {t('register_button')}
            </Button>
        </div>
        
        <div className="relative pt-2">
            <Separator />
            <span className="absolute left-1/2 -top-1 -translate-x-1/2 bg-card px-2 text-muted-foreground text-sm">{t('or_separator')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="w-full bg-background border-border">
              <svg className="mr-2 h-4 w-4" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.6402 9.20455C17.6402 8.56636 17.5855 7.95455 17.4761 7.36364H9V10.8409H13.8436C13.6364 11.9659 13.0091 12.9318 12.0432 13.5682V15.7045H14.4761C16.3409 14.0455 17.6402 11.8318 17.6402 9.20455Z" fill="#4285F4"/>
                <path d="M9.00023 18C11.4332 18 13.4673 17.1818 14.4775 15.7045L12.0434 13.5682C11.2252 14.125 10.215 14.4545 9.00023 14.4545C6.88773 14.4545 5.15318 13.0114 4.54568 11.0568H2.0125V13.1591C3.05682 15.2273 5.79682 18 9.00023 18Z" fill="#34A853"/>
                <path d="M4.54541 11.0568C4.37041 10.5568 4.27609 10.0114 4.27609 9.45455C4.27609 8.89773 4.37041 8.35227 4.54541 7.85227V5.75H2.01245C1.04814 7.75 0.500227 9.45455 0.500227 11.375C0.500227 13.2955 1.04814 15.0000 2.01245 16.9545L4.54541 14.8523V11.0568Z" fill="#FBBC05"/>
                <path d="M9.00023 3.54545C10.3525 3.54545 11.508 4.02273 12.4411 4.91818L14.5229 2.84091C13.4659 1.84091 11.4318 0.909091 9.00023 0.909091C5.79682 0.909091 3.05682 2.77273 2.0125 4.84091L4.54545 6.94318C5.15318 4.98864 6.88773 3.54545 9.00023 3.54545Z" fill="#EA4335"/>
              </svg>
              Google
          </Button>
          <Button variant="outline" className="w-full bg-background border-border" onClick={() => setIsPhoneLogin(true)} type="button">
            <Smartphone className="mr-2 h-4 w-4" />
            {t('phone_button')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
