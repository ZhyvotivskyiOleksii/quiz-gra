import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegisterForm } from "@/components/auth/register-form";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  // Server-side: if already authenticated, go to app
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove: (name: string, options: any) => {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  );
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect('/app');

  return (
    <div className="container max-w-xl mx-auto px-4 py-8 sm:py-12">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold uppercase">Rejestracja</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}

