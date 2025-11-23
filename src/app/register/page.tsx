import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { RegisterForm } from '@/components/auth/register-form'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'

export default async function RegisterPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <AuthPageShell
      title="Załóż konto"
      subtitle="Potwierdź telefon, aby zawsze mieć dostęp do swoich quizów."
      footer={
        <span>
          Masz już konto?{' '}
          <Link href="/login" className="font-semibold text-white hover:text-white/90 underline-offset-4 hover:underline">
            Zaloguj się
          </Link>
        </span>
      }
    >
      <RegisterForm />
    </AuthPageShell>
  )
}
