import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export default async function ProfilePage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map(c => ({ name: c.name, value: c.value })),
      } as any,
    }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/?auth=login')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>Zarządzaj swoimi danymi i preferencjami.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage data-ai-hint="person face" src="https://picsum.photos/seed/user1/80/80" />
                    <AvatarFallback>JK</AvatarFallback>
                </Avatar>
                <Button variant="outline">Zmień zdjęcie</Button>
            </div>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">Imię</Label>
                    <Input id="firstName" defaultValue="Jan" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Nazwisko</Label>
                    <Input id="lastName" defaultValue="Kowalski" />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="jan.kowalski@example.com" disabled />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Numer telefonu</Label>                <Input id="phone" defaultValue="+48 123 456 789" disabled />
            </div>

            <Separator />
            
            <div>
              <h3 className="text-lg font-medium">Zgody</h3>
              <div className="space-y-4 mt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="marketing" defaultChecked />
                  <label
                    htmlFor="marketing"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Zgoda marketingowa
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                    Chcę otrzymywać informacje o nowościach i promocjach.
                </p>
              </div>
            </div>

            <Button>Zapisz zmiany</Button>
        </CardContent>
      </Card>
    </div>
  );
}
export const dynamic = 'force-dynamic'
export const revalidate = 0
