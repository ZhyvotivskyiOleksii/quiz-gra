'use client';
import { useState } from 'react';
import { generateQuizQuestions, type GenerateQuizQuestionsInput, type GenerateQuizQuestionsOutput } from '@/ai/flows/generate-quiz-questions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Wand2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

export default function GenerateQuestionsPage() {
  const [topic, setTopic] = useState('Historia Polski');
  const [difficulty, setDifficulty] = useState('medium');
  const [numberOfQuestions, setNumberOfQuestions] = useState(5);
  const [generated, setGenerated] = useState<GenerateQuizQuestionsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setGenerated(null);
    try {
      const input: GenerateQuizQuestionsInput = {
        topic,
        difficulty,
        numberOfQuestions,
      };
      const result = await generateQuizQuestions(input);
      setGenerated(result);
    } catch (e) {
      setError('Wystąpił błąd podczas generowania pytań.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    // Mock save action
    toast({
        title: "Sukces!",
        description: "Pytania zostały zapisane w systemie.",
    });
    setGenerated(null);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generator pytań AI</CardTitle>
          <CardDescription>
            Użyj AI, aby szybko wygenerować nowe pytania do quizu. Podaj temat, poziom trudności i liczbę pytań.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="topic">Temat</Label>
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="np. II Wojna Światowa" />
            </div>
            <div>
              <Label htmlFor="difficulty">Poziom trudności</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger id="difficulty">
                  <SelectValue placeholder="Wybierz poziom" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Łatwy</SelectItem>
                  <SelectItem value="medium">Średni</SelectItem>
                  <SelectItem value="hard">Trudny</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="num-questions">Liczba pytań</Label>
              <Input id="num-questions" type="number" value={numberOfQuestions} onChange={(e) => setNumberOfQuestions(parseInt(e.target.value, 10))} min="1" max="10" />
            </div>
          </div>
          <Button onClick={handleGenerate} disabled={isLoading} className="mt-4">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generowanie...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generuj pytania
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Błąd</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {generated && generated.questions && (
        <Card>
          <CardHeader>
            <CardTitle>Wygenerowane pytania</CardTitle>
            <CardDescription>Przejrzyj pytania i zapisz je w systemie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {generated.questions.map((q, index) => (
              <div key={index}>
                <p className="font-semibold">{index + 1}. {q.question}</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {q.answers.map((ans, ansIndex) => {
                    const letter = String.fromCharCode(65 + ansIndex);
                    const isCorrect = letter === q.correctAnswer;
                    return (
                        <li key={ansIndex} className={`flex items-center gap-2 ${isCorrect ? 'text-green-600 dark:text-green-400 font-medium' : ''}`}>
                            {isCorrect && <CheckCircle className="h-4 w-4" />}
                            <span>{letter}. {ans}</span>
                        </li>
                    )
                  })}
                </ul>
                {index < generated.questions.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
            <div className="flex gap-2 pt-4">
                <Button onClick={handleSave}>Zapisz wszystkie pytania</Button>
                <Button variant="outline" onClick={() => setGenerated(null)}>Odrzuć</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
