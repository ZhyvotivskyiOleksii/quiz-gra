export type PrizeBracketRow = {
  id: string
  correct: number
  pool: number
}

export type PrizeBracketInsertPayload = {
  correct_answers: number
  pool: number
}

type BracketSeed = {
  correct: number
  pool: number
}

export const DEFAULT_PRIZE_BRACKETS: BracketSeed[] = [
  { correct: 5, pool: 2000 },
  { correct: 6, pool: 4000 },
]

const DEFAULT_PRIZE_TOTAL = DEFAULT_PRIZE_BRACKETS.reduce((sum, row) => sum + row.pool, 0)

export function generateBracketRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 10)
}

export function seedPrizeBrackets(): PrizeBracketRow[] {
  return DEFAULT_PRIZE_BRACKETS.map((row) => ({
    ...row,
    id: generateBracketRowId(),
  }))
}

export function sumPrizePools(brackets: Array<{ pool: number }>): number {
  return brackets.reduce((sum, row) => {
    const value = Number(row.pool)
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)
}

/**
 * Aggregates raw UI rows into the payload expected by quiz_prize_brackets (correct_answers, pool).
 */
export function normalizePrizeBrackets(
  brackets: Array<{ correct: number; pool: number }>,
): PrizeBracketInsertPayload[] {
  const map = new Map<number, number>()
  brackets.forEach((row) => {
    const correctRaw = Number(row.correct)
    const poolRaw = Number(row.pool)
    if (!Number.isFinite(correctRaw) || !Number.isFinite(poolRaw)) return
    const correct = Math.max(1, Math.floor(correctRaw))
    const pool = poolRaw
    if (pool <= 0) return
    if (correct < 5) return
    map.set(correct, (map.get(correct) || 0) + pool)
  })
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([correct_answers, pool]) => ({ correct_answers, pool }))
}

export function matchesDefaultBracketStructure(brackets: PrizeBracketRow[]): boolean {
  if (brackets.length !== DEFAULT_PRIZE_BRACKETS.length) return false
  return brackets.every((row, idx) => row.correct === DEFAULT_PRIZE_BRACKETS[idx].correct)
}

export function distributePrizeByDefaultRatios(brackets: PrizeBracketRow[], total: number): PrizeBracketRow[] {
  if (total <= 0 || !Number.isFinite(total) || brackets.length === 0) return brackets
  const ratios = DEFAULT_PRIZE_BRACKETS.map((seed) => (DEFAULT_PRIZE_TOTAL > 0 ? seed.pool / DEFAULT_PRIZE_TOTAL : 0))
  let allocated = 0
  return brackets.map((row, idx) => {
    let share = Math.round(total * (ratios[idx] ?? 0))
    if (idx === brackets.length - 1) {
      share = Math.max(0, Math.round(total - allocated))
    }
    allocated += share
    return { ...row, pool: share }
  })
}
