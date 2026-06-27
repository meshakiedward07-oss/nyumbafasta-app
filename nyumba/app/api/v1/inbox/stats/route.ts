import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

export async function GET() {
  const user = await assertAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('message_classifications')
    .select('category, action')

  const rows = data ?? []
  return NextResponse.json({
    flagged:      rows.filter(r => r.action === 'flagged').length,
    autoReplied:  rows.filter(r => r.action === 'auto_replied').length,
    ownerReplied: rows.filter(r => r.action === 'owner_replied').length,
    spam:         rows.filter(r => r.action === 'ignored').length,
    total:        rows.length,
  })
}
