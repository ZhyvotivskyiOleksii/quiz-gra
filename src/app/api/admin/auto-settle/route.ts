import { NextRequest, NextResponse } from 'next/server'
import { autoSettle } from '@/lib/autoSettle'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
  const secret = process.env.ADMIN_GRANT_SECRET
  if (!secret || token !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  try {
    const summary = await autoSettle()
    return NextResponse.json({ ok: true, ...summary })
  } catch (err: any) {
    console.error('auto-settle error', err)
    return NextResponse.json({ ok: false, error: err?.message || 'internal_error' }, { status: 500 })
  }
}
