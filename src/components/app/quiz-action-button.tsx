"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronRight, PenSquare } from 'lucide-react'
import { PhoneGateDialog } from '@/components/app/phone-gate-dialog'

type QuizActionButtonProps = {
  quizId: string
  isClosed: boolean
  hasSubmission: boolean
  actionLabel: string
  needsPhone: boolean
}

export function QuizActionButton({
  quizId,
  isClosed,
  hasSubmission,
  actionLabel,
  needsPhone,
}: QuizActionButtonProps) {
  const router = useRouter()
  const [gateOpen, setGateOpen] = React.useState(false)
  const [requiresPhone, setRequiresPhone] = React.useState(needsPhone)

  const handleNavigate = React.useCallback(() => {
    if (!quizId) return
    router.push(`/app/quizzes/${quizId}/play`)
  }, [quizId, router])

  const handleClick = () => {
    if (isClosed) return
    if (requiresPhone) {
      setGateOpen(true)
      return
    }
    handleNavigate()
  }

  const handleVerified = () => {
    setRequiresPhone(false)
    setGateOpen(false)
    handleNavigate()
  }

  const buttonClass = React.useMemo(() => {
    if (isClosed) return 'h-10 rounded-full bg-white/15 text-white/70 cursor-not-allowed'
    return cn(
      'h-10 rounded-full font-semibold shadow transition-colors',
      hasSubmission ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-yellow-400 text-black hover:bg-yellow-300',
    )
  }, [isClosed, hasSubmission])

  return (
    <>
      <Button type="button" disabled={isClosed} onClick={handleClick} className={buttonClass}>
        {hasSubmission && !isClosed ? <PenSquare className="mr-1.5 h-4 w-4" /> : null}
        {actionLabel}
        {!hasSubmission && !isClosed ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
      </Button>
      <PhoneGateDialog open={gateOpen} onOpenChange={setGateOpen} onVerified={handleVerified} />
    </>
  )
}

export default QuizActionButton
