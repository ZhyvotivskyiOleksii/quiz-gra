import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type SubmissionRow = {
  id: string
  quiz_id: string | null
  submitted_at: string | null
  quizzes: {
    title?: string | null
    rounds?: { label?: string | null } | null
  } | null
}

type ResultRow = {
  submission_id: string | null
  total_correct: number | null
  total_questions: number | null
  status: string | null
  prize_awarded: number | null
}

export default async function HistoryPage() {
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

  const { data: submissions = [] } = await supabase
    .from('quiz_submissions')
    .select('id,quiz_id,submitted_at,quizzes(title,rounds(label))')
    .eq('user_id', session.user.id)
    .order('submitted_at', { ascending: false }) as unknown as { data: SubmissionRow[] }

  const submissionIds = submissions.map(s => s.id)
  let results: ResultRow[] = []
  if (submissionIds.length) {
    const { data = [] } = await supabase
      .from('quiz_results')
      .select('submission_id,total_correct,total_questions,status,prize_awarded')
      .in('submission_id', submissionIds) as unknown as { data: ResultRow[] }
    results = data
  }
  const resultMap = new Map(results.map(r => [r.submission_id ?? '', r]))

  const history = submissions.map((submission) => {
    const result = resultMap.get(submission.id)
    const totalCorrect = result?.total_correct ?? null
    const totalQuestions = result?.total_questions ?? null
    const statusRaw = result?.status ?? null
    const prize = typeof result?.prize_awarded === 'number' ? Number(result?.prize_awarded) : null
    const statusLabel =
      statusRaw === 'won'
        ? 'Wygrana'
        : statusRaw === 'lost'
          ? 'Rozliczony'
          : statusRaw
    const pending = !statusRaw
    return {
      id: submission.id,
      quizId: submission.quiz_id,
      title: submission.quizzes?.title ?? 'Wiktoryna',
      round: submission.quizzes?.rounds?.label ?? null,
      submittedAt: submission.submitted_at ? new Date(submission.submitted_at) : null,
      totalCorrect,
      totalQuestions,
      pending,
      prize,
      status: statusLabel ?? (pending ? 'Oczekuje na rozliczenie' : 'Rozliczony'),
    }
  })

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border border-white/10 bg-[rgba(4,6,18,0.9)] shadow-[0_45px_90px_rgba(3,3,12,0.55)]">
        <CardHeader className="relative flex flex-col gap-2 bg-gradient-to-r from-white/5 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-headline text-white">Historia gier</CardTitle>
              <CardDescription className="text-white/70">Przeglądaj swoje poprzednie quizy i wyniki.</CardDescription>
            </div>
            <div className="relative h-20 w-20 sm:h-24 sm:w-24">
              <Image
                src="/icon/calendar.webp"
                alt=""
                fill
                className="object-contain drop-shadow-[0_15px_40px_rgba(0,0,0,0.45)]"
                priority={false}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                <TableHead className="text-white/80">Data</TableHead>
                <TableHead className="text-white/80">Quiz</TableHead>
                <TableHead className="text-white/80">Wynik</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
                <TableHead className="text-right text-white/80">Szczegóły</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-white/60">
                    Nie masz jeszcze żadnych quizów w historii. Zagraj w SuperGame, aby zobaczyć swoje wyniki.
                  </TableCell>
                </TableRow>
              )}
              {history.map(entry => (
                <TableRow key={entry.id} className="border-white/5 hover:bg-white/5/30">
                  <TableCell className="text-white">
                    {entry.submittedAt ? entry.submittedAt.toLocaleDateString('pl-PL') : '—'}
                  </TableCell>
                  <TableCell className="text-white">
                    <div className="font-semibold">{entry.title}</div>
                    {entry.round && <div className="text-xs text-white/60">{entry.round}</div>}
                  </TableCell>
                  <TableCell className="font-semibold text-white">
                    {typeof entry.totalCorrect === 'number' && typeof entry.totalQuestions === 'number'
                      ? `${entry.totalCorrect} / ${entry.totalQuestions}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={entry.pending ? 'outline' : entry.prize ? 'default' : 'secondary'}
                      className={entry.prize ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' : ''}
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {entry.quizId ? (
                      <Button asChild variant="ghost" size="sm" className="text-white/80 hover:text-white">
                        <Link href={`/app/quizzes/${entry.quizId}/play`}>Zobacz quiz</Link>
                      </Button>
                    ) : null}
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
export const dynamic = 'force-dynamic'
export const revalidate = 0
