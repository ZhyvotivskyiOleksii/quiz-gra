'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import React from 'react';
import { cn } from '@/lib/utils';
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
// Input not directly used after NotchedInput migration
import NotchedInput from '@/components/ui/notched-input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Link } from '@/navigation';
import { getSupabase } from '@/lib/supabaseClient';

type RegisterFormProps = {
  onSuccess?: () => void;
};

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isOtpStep, setIsOtpStep] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState('');
  const [pendingPhone, setPendingPhone] = React.useState('');
  const [pendingPassword, setPendingPassword] = React.useState('');
  const t = useTranslations('RegisterForm');

  const formSchema = z.object({
    firstName: z.string().min(1, { message: t('validation.firstName_required') }),
    lastName: z.string().min(1, { message: t('validation.lastName_required') }),
    email: z.string().min(1, t('validation.email_required')).email({ message: t('validation.email_invalid') }),
    phone: z
      .string()
      .min(6, { message: t('validation.phone_required') })
      .regex(/^\+?\d{6,15}$/,
        { message: t('validation.phone_invalid') }),
    password: z.string().min(8, { message: t('validation.password_min_length') }),
    confirmPassword: z.string().min(8, { message: t('validation.password_min_length') }),
    isOfAge: z.boolean().refine(val => val === true, {
      message: t('validation.age_confirmation_required'),
    }),
    marketingConsent: z.boolean().default(false),
  }).refine(data => data.password === data.confirmPassword, {
    message: t('validation.passwords_do_not_match'),
    path: ['confirmPassword'],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      isOfAge: false,
      marketingConsent: false,
    },
    mode: 'onBlur',
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const phone = values.phone.startsWith('+') ? values.phone : `+${values.phone}`

      const supabase = getSupabase();
      // Sign up using phone only to avoid email confirmation.
      const { error } = await supabase.auth.signUp({
        phone,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            marketing_consent: values.marketingConsent,
            contact_email: values.email, // store email only as metadata
          },
        },
      })

      if (error) {
        throw error
      }

      setPendingPhone(phone)
      setPendingPassword(values.password)
      setIsOtpStep(true)
      toast({ title: t('otp_sent_toast') })
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
      const { data, error } = await supabase.auth.verifyOtp({ phone: pendingPhone, token: otpCode, type: 'sms' })
      if (error) throw error
      // If session wasn't created, sign in with password
      if (!data.session) {
        await supabase.auth.signInWithPassword({ phone: pendingPhone, password: pendingPassword })
      }
      toast({ title: t('toast.success_title'), description: t('toast.success_description') })
      onSuccess?.()
    } catch (err: any) {
      toast({ title: t('otp_invalid_toast'), description: err?.message ?? 'Invalid code', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  async function resendCode() {
    if (!pendingPhone) return
    try {
      setIsLoading(true)
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone })
      if (error) throw error
      toast({ title: t('otp_sent_toast') })
    } catch (err: any) {
      toast({ title: 'SMS error', description: err?.message ?? 'Unknown error', variant: 'destructive' as any })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      {!isOtpStep ? (
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      label={t('firstName_label')}
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
                      label={t('lastName_label')}
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
                  label={t('email_label')}
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
                <NotchedInput
                  type="tel"
                  autoComplete="tel"
                  {...field}
                  error={!!fieldState.error}
                  label={t('phone_label')}
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <NotchedInput
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  {...field}
                  error={!!fieldState.error}
                  label={t('confirm_password_label')}
                  rightAdornment={
                    <Button
                      type="button"
                      aria-label={showConfirmPassword ? t('confirm_password_label') + ' hide' : t('confirm_password_label') + ' show'}
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  }
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
        <p className="text-xs text-muted-foreground pt-2">{t('sms_note')}</p>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('create_account_button')}
        </Button>
      </form>
      ) : (
        <div className="space-y-4">
          <NotchedInput
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            label={t('otp_code_label')}
          />
          <div className="flex items-center justify-between">
            <Button className="w-full" onClick={onVerifyOtp} disabled={isLoading || otpCode.length === 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('verify_code_button')}
            </Button>
          </div>
          <button type="button" onClick={resendCode} className="text-sm text-primary hover:underline">
            {t('resend_code_link')}
          </button>
        </div>
      )}
    </Form>
  );
}
