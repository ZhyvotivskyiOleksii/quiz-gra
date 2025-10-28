import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Frown } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
      <Frown className="w-32 h-32 text-primary mb-8" />
      <h1 className="text-6xl font-bold font-headline text-primary">404</h1>
      <h2 className="text-2xl font-semibold mt-4 mb-2">Strona nie została znaleziona</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Wygląda na to, że strona, której szukasz, nie istnieje lub została przeniesiona.
      </p>
      <Button asChild size="lg">
        <Link href="/">Wróć na stronę główną</Link>
      </Button>
    </div>
  );
}
