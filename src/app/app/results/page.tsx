import Image from 'next/image'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card'
import { Trophy, Flame, CheckCircle2 } from 'lucide-react'
import { ResultsAccordion } from '@/components/results/results-accordion'

type SubmissionSummary = {
  id: string
  quizTitle: string
  roundLabel?: string | null
  deadline?: string | null
  submittedAt: string | null
  imageUrl?: string | null
  prize?: number | null
  status: 'won' | 'lost' | 'pending'
  correct: number
  total: number
  points?: number | null
}

export default async function ResultsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
      } as any,
    },
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/?auth=login')

  const { data: submissionsResp } = await supabase
    .from('quiz_submissions')
    .select('id,quiz_id,submitted_at')
    .eq('user_id', session.user.id)
    .order('submitted_at', { descending: true })
    .limit(12)
  const submissionsData = submissionsResp ?? []

  const quizIds = submissionsData.map((s) => s.quiz_id).filter(Boolean)
  let quizzesData: any[] = []
  if (quizIds.length) {
    const { data } = await supabase
      .from('quizzes')
      .select('id,title,image_url,prize,round_id')
      .in('id', quizIds)
    quizzesData = data ?? []
  }

  const roundIds = quizzesData.map((q) => q.round_id).filter(Boolean)
  let roundsData: any[] = []
  if (roundIds.length) {
    const { data } = await supabase
      .from('rounds')
      .select('id,label,deadline_at')
      .in('id', roundIds)
    roundsData = data ?? []
  }

  const submissionIds = submissionsData.map((s) => s.id)
  let resultsRows: any[] = []
  if (submissionIds.length) {
    const { data } = await supabase
      .from('quiz_results')
      .select('submission_id,status,total_correct,total_questions,points')
      .in('submission_id', submissionIds)
    resultsRows = data ?? []
  }

  const quizMap = new Map(quizzesData.map((q) => [q.id, q]))
  const roundMap = new Map(roundsData.map((r) => [r.id, r]))
  const resultMap = new Map(resultsRows.map((r) => [r.submission_id, r]))

  const submissions: SubmissionSummary[] = submissionsData.map((submission) => {
    const quiz = quizMap.get(submission.quiz_id)
    const round = quiz ? roundMap.get(quiz.round_id) : null
    const result = resultMap.get(submission.id)
    const status =
      (result?.status as SubmissionSummary['status']) ||
      (result?.points && result.points > 0 ? 'won' : result ? 'lost' : 'pending')

    return {
      id: submission.id,
      quizTitle: quiz?.title ?? 'Wiktoryna',
      roundLabel: round?.label ?? null,
      deadline: round?.deadline_at ?? null,
      submittedAt: submission.submitted_at,
      imageUrl: quiz?.image_url ?? '/images/preview.webp',
      prize: quiz?.prize ?? null,
      status,
      correct: result?.total_correct ?? 0,
      total: result?.total_questions ?? 6,
      points: result?.points ?? null,
    }
  })

  const totalRounds = submissions.length
  const wins = submissions.filter((s) => s.status === 'won').length
  const correctAnswers = submissions.reduce((sum, s) => sum + (s.correct || 0), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          title="Wygrane"
          icon={<Trophy className="h-5 w-5 text-yellow-300" />}
          value={wins}
          description="+ wygrane rundy"
        />
        <StatCard
          title="Rozegrane rundy"
          icon={<Flame className="h-5 w-5 text-orange-300" />}
          value={totalRounds}
          description="Twoje ostatnie gry"
        />
        <StatCard
          title="Poprawne odpowiedzi"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-300" />}
          value={correctAnswers}
          description="+ łączny wynik"
        />
      </div>

      <ResultsAccordion submissions={submissions} />
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: number
  description?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="rounded-3xl border-white/10 bg-gradient-to-br from-[#281422] via-[#1a1221] to-[#110c18] text-white shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardDescription className="text-xs uppercase tracking-wide text-white/70">{title}</CardDescription>
        {icon}
      </CardHeader>
      <CardContent>
        <CardTitle className="text-4xl font-extrabold">{value}</CardTitle>
        {description && <p className="mt-1 text-sm text-white/70">{description}</p>}
      </CardContent>
    </Card>
  )
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
