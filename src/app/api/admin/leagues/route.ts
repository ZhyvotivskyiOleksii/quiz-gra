import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/createServerSupabase'
import { createClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'missing service key' }, { status: 500 })
  }

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await serviceClient.from('leagues').select('id,name,code').order('name', { ascending: true })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] }, { status: 200 })
}
