import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { History, Trophy, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <Card className="border-0 bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 shadow-2xl backdrop-blur overflow-hidden">
        <CardHeader className="border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30">
              <History className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">Historia gier</CardTitle>
              <CardDescription className="text-white/50">Przeglądaj swoje poprzednie quizy i wyniki</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mb-3 text-4xl">📋</div>
              <p className="text-sm text-white/60">Nie masz jeszcze żadnych quizów w historii</p>
              <p className="text-xs text-white/40">Zagraj w SuperGame, aby zobaczyć swoje wyniki</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {history.map((entry, index) => {
                const isWin = entry.prize && entry.prize > 0
                const isPerfect = entry.totalCorrect === entry.totalQuestions && entry.totalQuestions !== null
                const scorePercent = entry.totalCorrect !== null && entry.totalQuestions !== null
                  ? Math.round((entry.totalCorrect / entry.totalQuestions) * 100)
                  : 0
                
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "group flex flex-col gap-3 px-4 py-4 transition-all sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02]",
                      index === 0 && "bg-gradient-to-r from-primary/5 to-transparent"
                    )}
                  >
                    {/* Left side: Date + Quiz info */}
                    <div className="flex items-center gap-4">
                      {/* Score badge */}
                      <div className={cn(
                        "flex h-12 w-12 flex-col items-center justify-center rounded-xl font-bold shrink-0",
                        isPerfect
                          ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                          : isWin
                            ? "bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-primary/30"
                            : entry.pending
                              ? "bg-white/10 text-white/50"
                              : "bg-white/5 text-white/60"
                      )}>
                        {entry.totalCorrect !== null && entry.totalQuestions !== null ? (
                          <>
                            <span className="text-lg leading-none">{entry.totalCorrect}</span>
                            <span className="text-[10px] opacity-70">/{entry.totalQuestions}</span>
                          </>
                        ) : (
                          <Clock className="h-5 w-5" />
                        )}
                      </div>
                      
                      {/* Quiz info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{entry.title}</span>
                          {isPerfect && <span className="text-sm">🏆</span>}
                          {isWin && !isPerfect && <span className="text-sm">✨</span>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/40">
                          {entry.round && <span>{entry.round}</span>}
                          {entry.round && entry.submittedAt && <span>•</span>}
                          {entry.submittedAt && (
                            <span>{entry.submittedAt.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Right side: Status + Actions */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {/* Progress bar (desktop only) */}
                      {!entry.pending && entry.totalCorrect !== null && (
                        <div className="hidden sm:flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all",
                                isPerfect ? "bg-emerald-500" : isWin ? "bg-primary" : "bg-white/30"
                              )}
                              style={{ width: `${scorePercent}%` }}
                            />
                          </div>
                          <span className={cn(
                            "text-xs font-medium w-8",
                            isPerfect ? "text-emerald-400" : isWin ? "text-primary" : "text-white/50"
                          )}>
                            {scorePercent}%
                          </span>
                        </div>
                      )}
                      
                      {/* Status badge */}
                      <div className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                        entry.pending
                          ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                          : isWin
                            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                            : "bg-white/5 text-white/50"
                      )}>
                        {entry.pending ? (
                          <Clock className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {entry.status}
                      </div>
                      
                      {/* Prize indicator */}
                      {isWin && (
                        <div className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-bold text-yellow-400">
                          +{entry.prize} pkt
                        </div>
                      )}
                      
                      {/* View button */}
                      {entry.quizId && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                          <Link href={`/app/quizzes/${entry.quizId}/play`}>
                            <ExternalLink className="h-4 w-4 mr-1.5" />
                            Zobacz
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export const dynamic = 'force-dynamic'
export const revalidate = 0
