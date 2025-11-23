import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { RegisterForm } from '@/components/auth/register-form'
export default async function RegisterPage() {
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
