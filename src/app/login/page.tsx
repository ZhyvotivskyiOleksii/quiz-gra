import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { LoginForm } from '@/components/auth/login-form'
type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) || {}
  const email = typeof params.email === 'string' ? params.email : undefined
  const password = typeof params.password === 'string' ? params.password : undefined
  const notice = typeof params.notice === 'string' ? params.notice : undefined
  const authError = typeof params.authError === 'string' ? params.authError : undefined

  // No automatic redirect - user should explicitly choose login method
  // If a session exists, LoginForm will display a logout option.

  return (
    <AuthPageShell
      title="Zaloguj się"
      subtitle="Wróć do swojej gry i wskocz od razu do panelu."
      footer={
        <span>
          Nie masz konta?{' '}
          <Link href="/register" className="font-semibold text-white hover:text-white/90 underline-offset-4 hover:underline">
            Zarejestruj się
          </Link>
        </span>
      }
    >
      <LoginForm initialEmail={email} initialPassword={password} notice={notice} authError={authError} redirectTo="/app" />
    </AuthPageShell>
  )
}
