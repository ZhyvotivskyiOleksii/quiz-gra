import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Server-side auth gating for localized admin
import { Activity, HelpCircle, Book, Users } from "lucide-react";
import { UsersActivityChart } from '@/components/admin/users-activity-chart'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'


const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

// Chart config is handled inside client chart component


export default async function AdminDashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: any) => { try { cookieStore.set({ name, value, ...options }) } catch {} },
        remove: (name: string, options: any) => { try { cookieStore.set({ name, value: '', ...options, maxAge: 0 }) } catch {} },
      },
    }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect(`/${locale}?auth=login`)
  const stats = [
    { title: "Aktywne pytania", value: "1,250", icon: HelpCircle, description: "+50 w tym tygodniu" },
    { title: "Do rozliczenia", value: "78", icon: Book, description: "12 pilnych" },
    { title: "Aktywni użytkownicy", value: "12,432", icon: Users, description: "+12% w tym miesiącu" },
    { title: "Sesje w ostatniej godz.", value: "541", icon: Activity, description: "Szczyt o 21:00" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold font-headline">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Aktywność użytkowników</CardTitle>
            <CardDescription>Liczba sesji w ostatnich 6 miesiącach.</CardDescription>
          </CardHeader>
          <CardContent>
            <UsersActivityChart data={chartData} />
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Ostatnie importy pytań</CardTitle>
            <CardDescription>Lista ostatnich importów i ich status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Historia_Polski_part1.csv</p>
                        <p className="text-sm text-muted-foreground">Zaimportowano: 150 pytań</p>
                    </div>
                    <div className="text-sm text-green-500">Sukces</div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Sport_Euro2024.csv</p>
                        <p className="text-sm text-muted-foreground">Zaimportowano: 25 pytań</p>
                    </div>
                    <div className="text-sm text-green-500">Sukces</div>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium">Geografia_Swiata_err.csv</p>
                        <p className="text-sm text-muted-foreground">Błędy walidacji w 5 wierszach</p>
                    </div>
                    <div className="text-sm text-destructive">Błąd</div>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic'
export const revalidate = 0
