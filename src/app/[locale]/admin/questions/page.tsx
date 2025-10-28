import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { File, ListFilter, PlusCircle, Upload, Wand2, MoreHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Link } from '@/navigation';

export default function QuestionsPage() {
  const questions = [
    { id: 'Q123', content: 'Kto był pierwszym królem Polski?', type: 'past', status: 'active', category: 'Historia' },
    { id: 'Q124', content: 'Czy Polska wygra Euro 2024?', type: 'future', status: 'active', category: 'Sport' },
    { id: 'Q125', content: 'Wynik meczu Polska - Holandia (Euro 2024)', type: 'future', status: 'to_settle', category: 'Sport' },
    { id: 'Q126', content: 'Stolica Australii to:', type: 'past', status: 'pending', category: 'Geografia' },
    { id: 'Q127', content: 'Kiedy odbyła się bitwa pod Grunwaldem?', type: 'past', status: 'settled', category: 'Historia' },
    { id: 'Q128', content: 'Kto wygra wybory prezydenckie w USA w 2024?', type: 'future', status: 'active', category: 'Polityka' },
    { id: 'Q129', content: 'Ile medali zdobędzie Polska na IO 2024?', type: 'future', status: 'withdrawn', category: 'Sport' },
  ];

  const statusVariants: {[key: string]: "default" | "secondary" | "destructive" | "outline"} = {
    active: "default",
    pending: "secondary",
    to_settle: "outline",
    settled: "secondary",
    withdrawn: "destructive"
  }

  return (
    <Tabs defaultValue="all">
      <div className="flex items-center">
        <TabsList>
          <TabsTrigger value="all">Wszystkie</TabsTrigger>
          <TabsTrigger value="active">Aktywne</TabsTrigger>
          <TabsTrigger value="pending">Oczekujące</TabsTrigger>
          <TabsTrigger value="to_settle" className="relative">Do rozliczenia <Badge className="absolute -top-2 -right-2 h-4 w-4 justify-center p-0">1</Badge></TabsTrigger>
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1">
                <ListFilter className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Filtruj
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filtruj po</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked>Typ: Historyczne</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Typ: Predykcyjne</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <File className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Eksportuj
            </span>
          </Button>
          <Button size="sm" className="h-8 gap-1">
            <Upload className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Importuj CSV
            </span>
          </Button>
          <Button asChild size="sm" className="h-8 gap-1">
            <Link href="/admin/questions/generate">
              <Wand2 className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Generuj AI
              </span>
            </Link>
          </Button>
          <Button size="sm" className="h-8 gap-1">
            <PlusCircle className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
              Dodaj pytanie
            </span>
          </Button>
        </div>
      </div>
      <TabsContent value="all">
        <Card>
          <CardHeader>
            <CardTitle>Zarządzanie pytaniami</CardTitle>
            <CardDescription>
              Przeglądaj, dodawaj, edytuj i usuwaj pytania w systemie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Treść</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Akcje</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.id}</TableCell>
                    <TableCell className="font-medium">{q.content}</TableCell>
                    <TableCell>{q.type === 'past' ? 'Historyczne' : 'Predykcyjne'}</TableCell>
                    <TableCell>
                        <Badge variant="outline">{q.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[q.status]}>{q.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Akcje</DropdownMenuLabel>
                          <DropdownMenuItem>Edytuj</DropdownMenuItem>
                          <DropdownMenuItem>Duplikuj</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Usuń</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
