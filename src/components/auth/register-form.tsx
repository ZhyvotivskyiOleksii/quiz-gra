'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormLabel,
} from '@/components/ui/form';
// Input not directly used after NotchedInput migration
import NotchedInput from '@/components/ui/notched-input';
import PhoneInputField from '@/components/ui/phone-input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { getSupabase } from '@/lib/supabaseClient';

type RegisterFormProps = {
  onSuccess?: (prefill?: { email?: string; password?: string; notice?: string }) => void;
};

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOtpStep, setIsOtpStep] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState('');
  const [pendingPhone, setPendingPhone] = React.useState('');
  const [pendingProfile, setPendingProfile] = React.useState<{firstName: string; lastName: string; email: string; password: string} | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  // Polish-only labels

  const formSchema = z.object({
    firstName: z.string().min(1, { message: 'Imię jest wymagane.' }),
    lastName: z.string().min(1, { message: 'Nazwisko jest wymagane.' }),
    email: z.string().min(1, 'Email jest wymagany.').email({ message: 'Nieprawidłowy adres email.' }),
    phone: z
      .string()
      .min(6, { message: 'Telefon jest wymagany.' })
      .regex(/^\+?\d{6,15}$/,
        { message: 'Nieprawidłowy numer telefonu.' }),
    password: z.string().min(8, { message: 'Hasło musi mieć co najmniej 8 znaków.' }),
    isOfAge: z.boolean().refine(val => val === true, {
      message: 'Musisz potwierdzić, że masz ukończone 18 lat i akceptujesz regulamin.',
    }),
    marketingConsent: z.boolean().default(true),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      isOfAge: true,
      marketingConsent: true,
    },
    mode: 'onBlur',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const phone = (values.phone.startsWith('+') ? values.phone : `+${values.phone}`).replace(/[^\d+]/g, '')

      const supabase = getSupabase();

      // Optional pre-check: email already used by any user (auth.users.email or metadata.contact_email)
      try {
        const { data: exists, error: existsErr } = await supabase.rpc('email_exists', { p_email: values.email.toLowerCase() })
        if (!existsErr && exists === true) {
          const msg = 'Ten email jest połączony z Google — Zaloguj się przez Google'
          toast({ title: msg })
          onSuccess?.({ email: values.email, notice: msg })
          setIsLoading(false)
          return
        }
      } catch {}
      // Start OTP sign-in (will create user if not exists)
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: true, channel: 'sms' as any },
      })

      if (error) {
        throw error
      }

      setPendingPhone(phone)
      setPendingProfile({ firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password })
      setIsOtpStep(true)
      toast({ title: 'Wysłano kod SMS.' })
    } catch (err: any) {
      toast({ title: 'Registration failed', description: err?.message ?? 'Unknown error', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  async function onVerifyOtp() {
    if (!pendingPhone) return
    setIsLoading(true)
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.verifyOtp({ phone: pendingPhone.replace(/[^\d+]/g, ''), token: otpCode, type: 'sms' })
      if (error) throw error
      // We have a session now; securely link email/password so it appears in Auth → Users
      if (pendingProfile) {
        try {
          const resp = await fetch('/api/auth/link-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              email: pendingProfile.email,
              password: pendingProfile.password,
              firstName: pendingProfile.firstName,
              lastName: pendingProfile.lastName,
              marketingConsent: form.getValues('marketingConsent') ?? false,
            }),
          })
          if (!resp.ok) {
            const j = await resp.json().catch(() => ({}))
            throw new Error(j?.error || 'Link email failed')
          }
        } catch {}
      }
      toast({ title: 'Rejestracja pomyślna!', description: 'Przekierowujemy do panelu…' })
      // Sync server cookies so /app server components see the session immediately
      try {
        await fetch('/auth/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ event: 'SIGNED_IN', session: data?.session }),
        })
      } catch {}
      // User already has a session after verifyOtp — go straight to app.
      // Use hard redirect to guarantee cookies are applied before SSR guard runs.
      try {
        if (typeof window !== 'undefined') {
          window.location.assign('/app')
        } else {
          router.replace('/app')
        }
      } catch {
        router.replace('/app')
      }
      onSuccess?.({ email: pendingProfile?.email, password: pendingProfile?.password })
    } catch (err: any) {
      toast({ title: 'Nieprawidłowy kod.', description: err?.message ?? 'Invalid code', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  async function resendCode() {
    if (!pendingPhone) return
    try {
      setIsLoading(true)
      const supabase = getSupabase();
      // Resend OTP for an already-started signup. Avoid creating a new user.
      const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone.replace(/[^\d+]/g, ''), options: { shouldCreateUser: false, channel: 'sms' as any } })
      if (error) throw error
      toast({ title: 'Wysłano kod SMS.' })
    } catch (err: any) {
      toast({ title: 'SMS error', description: err?.message ?? 'Unknown error', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      {!isOtpStep ? (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2.5 sm:space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <NotchedInput
                      autoComplete="given-name"
                      {...field}
                      error={!!fieldState.error}
                      label={'Imię'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field, fieldState }) => (
                <FormItem>
                  <FormControl>
                    <NotchedInput
                      autoComplete="family-name"
                      {...field}
                      error={!!fieldState.error}
                      label={'Nazwisko'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
            )}
          />
        </div>
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
                  label={'Email'}
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
                  autoComplete="new-password"
                  {...field}
                  error={!!fieldState.error}
                  label={'Hasło'}
                  rightAdornment={
                    <Button
                      type="button"
                      aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <PhoneInputField
                  id="register-phone"
                  label={'Telefon'}
                  value={field.value}
                  onChange={field.onChange}
                  error={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-4 pt-2">
          <FormField
            control={form.control}
            name="isOfAge"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className={cn(form.getFieldState('isOfAge').error && 'border-destructive')}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">Mam ukończone 18 lat i akceptuję <a href="#" className="underline">Regulamin</a>.</FormLabel>
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
                  <FormLabel className="text-sm font-normal leading-none pointer-events-auto">Zgoda marketingowa – (opcjonalnie)</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>
        <p className="text-xs text-muted-foreground pt-2">W kolejnym kroku otrzymasz SMS z kodem weryfikacyjnym.</p>
        <Button type="submit" className="w-full h-10 sm:h-11" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Wyślij kod
        </Button>
      </form>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          <NotchedInput
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            label={'Kod z SMS'}
          />
          <div className="flex items-center justify-between">
            <Button className="w-full h-10 sm:h-11" onClick={onVerifyOtp} disabled={isLoading || otpCode.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Utwórz konto
            </Button>
          </div>
          <button type="button" onClick={resendCode} className="text-sm text-primary hover:underline">
            Wyślij kod ponownie
          </button>
        </div>
      )}
    </Form>
  );
}
