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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({})) as { action?: string }
  const { action } = body

  const db = createAdminClient()

  if (action === 'flag') {
    const { error } = await db.from('reviews').update({ is_flagged: true }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, message: 'Mapitio yamewekwa bendera' })
  }

  if (action === 'unflag') {
    const { error } = await db.from('reviews').update({ is_flagged: false }).eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, message: 'Bendera imeondolewa' })
  }

  if (action === 'delete') {
    const { error } = await db.from('reviews').delete().eq('id', id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ success: true, message: 'Mapitio yamefutwa' })
  }

  return Response.json({ error: 'Kitendo kisichojulikana' }, { status: 400 })
}
