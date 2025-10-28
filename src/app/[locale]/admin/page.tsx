import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, HelpCircle, Book, Users } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"


const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "hsl(var(--primary))",
  },
}


export default function AdminDashboard() {
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
            <ChartContainer config={chartConfig}>
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value.slice(0, 3)}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Bar dataKey="desktop" fill="var(--color-desktop)" radius={8} />
              </BarChart>
            </ChartContainer>
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
