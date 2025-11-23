import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return NextResponse.json({ ok: !!session })
}
