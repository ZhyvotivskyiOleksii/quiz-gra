import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label";

export default function SettlementsPage() {
  const questionsToSettle = [
    { 
      id: 'Q125', 
      content: 'Wynik meczu Polska - Holandia (Euro 2024)', 
      answers: ['A. Wygrana Polski', 'B. Remis', 'C. Wygrana Holandii', 'D. Mecz odwołany'],
      validUntil: '2024-06-16T17:00:00Z'
    },
    { 
      id: 'Q131', 
      content: 'Jaka będzie inflacja CPI w Polsce w lipcu 2024?', 
      answers: ['A. Poniżej 2.5%', 'B. Między 2.5% a 3.0%', 'C. Między 3.0% a 3.5%', 'D. Powyżej 3.5%'],
      validUntil: '2024-08-15T10:00:00Z'
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Rozliczanie pytań</CardTitle>
          <CardDescription>
            Pytania typu "predykcyjne", których data ważności minęła, oczekują na przypisanie poprawnej odpowiedzi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Pytania</TableHead>
                <TableHead>Treść</TableHead>
                <TableHead>Data ważności</TableHead>
                <TableHead className="text-right">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionsToSettle.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.id}</TableCell>
                  <TableCell>{q.content}</TableCell>
                  <TableCell>{new Date(q.validUntil).toLocaleString('pl-PL')}</TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button>Rozlicz</Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Rozlicz pytanie: {q.id}</DialogTitle>
                          <DialogDescription>
                            Wybierz poprawną odpowiedź dla pytania: "{q.content}"
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <RadioGroup defaultValue="b">
                            {q.answers.map((answer, index) => {
                              const value = String.fromCharCode(65 + index);
                              return (
                                <div key={value} className="flex items-center space-x-2">
                                  <RadioGroupItem value={value.toLowerCase()} id={`${q.id}-${value}`} />
                                  <Label htmlFor={`${q.id}-${value}`}>{answer}</Label>
                                </div>
                              );
                            })}
                          </RadioGroup>
                        </div>
                        <DialogFooter>
                          <Button type="submit">Zatwierdź odpowiedź</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
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
