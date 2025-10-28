import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
  const gameHistory = [
    { id: 'g_1', date: '2024-08-01', score: 4, settled: true },
    { id: 'g_2', date: '2024-07-30', score: 5, settled: true },
    { id: 'g_3', date: '2024-07-29', score: 3, settled: false },
    { id: 'g_4', date: '2024-07-28', score: 6, settled: true },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Historia gier</CardTitle>
          <CardDescription>Przeglądaj swoje poprzednie quizy i wyniki.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Wynik</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Szczegóły</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gameHistory.map(game => (
                <TableRow key={game.id}>
                  <TableCell>{game.date}</TableCell>
                  <TableCell className="font-medium">{game.score} / 6</TableCell>
                  <TableCell>
                    <Badge variant={game.settled ? 'default' : 'outline'}>
                      {game.settled ? 'Rozliczony' : 'Oczekuje na rozliczenie'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Placeholder for details link/button */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
