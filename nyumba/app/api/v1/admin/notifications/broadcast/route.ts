import { NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function verifyAdmin() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data } = await sb.from('users').select('role').eq('id', user.id).single()
  return data?.role === 'admin' ? user : null
}

// GET — fetch recent broadcast notifications sent by admin
export async function GET() {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const db = createAdminClient()

  const { data } = await db
    .from('notifications')
    .select('id, title, body, type, created_at, data')
    .eq('type', 'admin_broadcast')
    .order('created_at', { ascending: false })
    .limit(20)

  return Response.json({ notifications: data ?? [] })
}

// POST — broadcast an in-app notification to a target audience
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as {
    title?: string
    message?: string
    audience?: string  // 'all' | 'dalali' | 'client'
    href?: string
  }

  const { title, message, audience = 'all', href = '' } = body

  if (!title?.trim() || !message?.trim()) {
    return Response.json({ error: 'Kichwa na ujumbe vinahitajika' }, { status: 400 })
  }
  if (!['all', 'dalali', 'client'].includes(audience)) {
    return Response.json({ error: 'Hadhira si sahihi' }, { status: 400 })
  }

  const db = createAdminClient()

  // Fetch target user IDs
  let userQuery = db.from('users').select('id').eq('is_active', true)
  if (audience !== 'all') userQuery = userQuery.eq('role', audience)
  const { data: users, error: usersErr } = await userQuery

  if (usersErr || !users?.length) {
    return Response.json({ error: 'Hakuna watumiaji waliochaguliwa' }, { status: 400 })
  }

  // Batch insert notifications
  const rows = users.map(u => ({
    user_id: u.id,
    title:   title.trim(),
    body:    message.trim(),
    type:    'admin_broadcast',
    is_read: false,
    data:    { href: href || null, sent_by: admin.id, audience },
  }))

  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db.from('notifications').insert(rows.slice(i, i + CHUNK))
    if (error) return Response.json({ error: error.message }, { status: 500 })
    inserted += rows.slice(i, i + CHUNK).length
  }

  return Response.json({ success: true, sent_to: inserted })
}
