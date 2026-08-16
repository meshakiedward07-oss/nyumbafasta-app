import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/organizations/:id/vendors
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { count: membership } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!membership && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const url        = req.nextUrl
    const category   = url.searchParams.get('category')
    const search     = url.searchParams.get('search')
    const activeOnly = url.searchParams.get('active') !== 'false'
    // verified_only=true: only return verified vendors (used by maintenance assignment dropdown)
    const verifiedOnly = url.searchParams.get('verified_only') === 'true'

    let query = admin
      .from('vendors')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true })

    if (activeOnly) query = query.eq('is_active', true)
    if (category && category !== 'all') query = query.eq('category', category)
    if (search?.trim()) query = query.ilike('name', `%${search.trim()}%`)

    // Non-admin org members only see verified vendors (unless asking for their own pending/rejected)
    // Admin/staff can see all statuses.
    // The vendor directory page passes active=false (to see all active states) — org members get only verified.
    // The maintenance dropdown passes verified_only=true explicitly.
    if (!isAdminStaff) {
      query = query.eq('verification_status', 'verified')
    } else {
      // Admin can filter by verification status
      const verificationStatus = url.searchParams.get('verification_status')
      if (verificationStatus) query = query.eq('verification_status', verificationStatus)
    }

    if (verifiedOnly) query = query.eq('verification_status', 'verified')

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ vendors: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations/:id/vendors]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations/:id/vendors
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    const canWrite = isAdminStaff || ['owner', 'branch_manager', 'agent'].includes(membership?.role ?? '')
    if (!canWrite) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { name, category = 'other', phone, email, specialty, location, notes } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Jina la fundi linahitajika' }, { status: 400 })

    const { data: vendor, error } = await admin
      .from('vendors')
      .insert({
        org_id:              orgId,
        name:                name.trim(),
        category,
        phone:               phone?.trim()     || null,
        email:               email?.trim()     || null,
        specialty:           specialty?.trim() || null,
        location:            location?.trim()  || null,
        notes:               notes?.trim()     || null,
        is_active:           true,
        verification_status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    // Notify all admin/staff users about the new pending vendor
    ;(async () => {
      try {
        const { data: admins } = await admin
          .from('users')
          .select('id')
          .in('role', ['admin', 'staff'])
          .eq('is_active', true)
        if (admins && admins.length > 0) {
          const { data: org } = await admin.from('organizations').select('name').eq('id', orgId).maybeSingle()
          await admin.from('notifications').insert(
            admins.map(a => ({
              user_id:  a.id,
              type:     'vendor_pending_verification',
              title:    'Fundi Mpya Anasubiri Uthibitisho',
              body:     `${name.trim()} kutoka ${org?.name ?? 'shirika'} anasubiri uthibitisho wako.`,
              data:     { vendor_id: vendor.id, org_id: orgId },
              is_read:  false,
            }))
          )
        }
      } catch { /* non-fatal */ }
    })().catch(() => {})

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations/:id/vendors]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
