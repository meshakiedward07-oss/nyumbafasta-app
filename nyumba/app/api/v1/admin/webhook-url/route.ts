import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Admin tu' }, { status: 403 })
  }

  const secret = process.env.WEBHOOK_SECRET
  const base   = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

  if (!secret) {
    return NextResponse.json({ error: 'WEBHOOK_SECRET haijawekwa Vercel' }, { status: 500 })
  }

  return NextResponse.json({
    unlock_webhook:       `${base}/api/v1/payments/webhook?whsec=${secret}`,
    subscription_webhook: `${base}/api/v1/payments/subscription/webhook?whsec=${secret}`,
  })
}
