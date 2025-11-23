import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { Card } from '@/components/ui/card'
import { ResultsAccordion } from '@/components/results/results-accordion'

type SubmissionSummary = {
  id: string
  quizTitle: string
  roundLabel?: string | null
  deadline?: string | null
  submittedAt: string | null
  imageUrl?: string | null
  prizePool?: number | null
  prizeAwarded?: number | null
  status: 'won' | 'lost' | 'pending'
  correct: number
  total: number
  points?: number | null
}

export default async function ResultsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: submissionsResp } = await supabase
    .from('quiz_submissions')
    .select('id,quiz_id,submitted_at')
    .eq('user_id', session.user.id)
    .order('submitted_at', { ascending: false })
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
      .select('submission_id,status,total_correct,total_questions,points,prize_awarded')
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
    const prizeAwarded = typeof result?.prize_awarded === 'number' ? Number(result.prize_awarded) : null
    const statusFromDb = result?.status as SubmissionSummary['status'] | undefined
    const status =
      statusFromDb ||
      (typeof prizeAwarded === 'number' && prizeAwarded > 0
        ? 'won'
        : result
          ? 'lost'
          : 'pending')

    return {
      id: submission.id,
      quizTitle: quiz?.title ?? 'Wiktoryna',
      roundLabel: round?.label ?? null,
      deadline: round?.deadline_at ?? null,
      submittedAt: submission.submitted_at,
      imageUrl: quiz?.image_url ?? '/images/preview.webp',
      prizePool: quiz?.prize ?? null,
      prizeAwarded,
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          title="Wygrane"
          value={wins}
          description="+ wygrane rundy"
          iconSrc="/images/kubok.png"
        />
        <StatCard
          title="Rozegrane rundy"
          value={totalRounds}
          description="Twoje ostatnie gry"
          iconSrc="/images/fire.png"
        />
        <StatCard
          title="Poprawne odpowiedzi"
          value={correctAnswers}
          description="+ łączny wynik"
          iconSrc="/images/ok.png"
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
  iconSrc,
}: {
  title: string
  value: number
  description?: string
  iconSrc: string
}) {
  return (
    <Card className="flex min-h-[120px] items-stretch rounded-3xl border border-white/10 bg-[rgba(25,12,22,0.95)] pl-5 pr-0 py-0 text-white shadow-lg overflow-hidden">
      <div className="flex flex-col justify-center py-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/60">{title}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-4xl font-extrabold">{value}</span>
          {description && <span className="text-xs text-white/70">{description}</span>}
        </div>
      </div>
      <div className="ml-auto flex flex-1 items-stretch justify-end">
        <div className="relative h-full min-h-[120px] w-[120px]">
          <Image
            src={iconSrc}
            alt=""
            fill
            sizes="110px"
            className="object-contain object-right drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
            priority={false}
          />
        </div>
      </div>
    </Card>
  )
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
