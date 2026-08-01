import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string; propertyId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: orgId, propertyId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const [memberRes, profileRes] = await Promise.all([
      admin.from('organization_members').select('role').eq('organization_id', orgId).eq('user_id', user.id).single(),
      admin.from('users').select('role').eq('id', user.id).single(),
    ])

    const isAdminStaff = ['admin', 'staff'].includes(profileRes.data?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager'].includes(memberRes.data?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const allowed = ['title', 'type', 'district', 'region', 'ward', 'mtaa', 'price_monthly', 'furnished', 'bedrooms', 'description', 'amenities', 'images']
    const patch: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) patch[k] = body[k]

    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Hakuna mabadiliko' }, { status: 400 })
    patch.updated_at = new Date().toISOString()

    const { data, error } = await admin
      .from('listings')
      .update(patch)
      .eq('id', propertyId)
      .eq('managing_org_id', orgId)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Mali haikupatikana' }, { status: 404 })
    return NextResponse.json({ listing: data })
  } catch (err) {
    console.error('[PATCH /organizations/:id/mali/:propertyId]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
