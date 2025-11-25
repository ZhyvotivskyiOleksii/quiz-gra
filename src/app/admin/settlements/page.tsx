import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { SettlementsClient } from '@/components/admin/settlements-client'
import { fetchPendingSettlementTargets, fetchSettlementRows } from '@/lib/admin/fetchSettlements'

export default async function SettlementsPage() {
  const authClient = await createServerSupabaseClient()
  const {
    data: { session },
  } = await authClient.auth.getSession()
  if (!session) redirect('/login')

  const [rows, pending] = await Promise.all([fetchSettlementRows(), fetchPendingSettlementTargets()])

  return <SettlementsClient initialRows={rows} initialPending={pending} />
}
