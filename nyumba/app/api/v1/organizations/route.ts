import { NextRequest, NextResponse } from 'next/server'
// NextRequest used in POST only; GET uses no request args
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET  /api/v1/organizations  — list orgs the current user belongs to
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('organization_members')
      .select(`
        id, role, joined_at,
        organization:organizations(*)
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ organizations: data ?? [] })
  } catch (err) {
    console.error('[GET /organizations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/organizations  — create a new organization (and join as owner)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const body = await req.json()
    const { name, org_type, description, phone, email, region, district } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Jina la shirika linahitajika' }, { status: 400 })
    if (!['landlord', 'property_manager', 'firm'].includes(org_type)) {
      return NextResponse.json({ error: 'Aina ya shirika si sahihi' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check: user can only own one org at a time (can be members of many)
    const { count } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'owner')

    if ((count ?? 0) >= 3) {
      return NextResponse.json({ error: 'Huwezi kuwa mwenye mashirika zaidi ya 3' }, { status: 400 })
    }

    const { data: org, error: orgErr } = await admin
      .from('organizations')
      .insert({ name: name.trim(), org_type, description: description?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null, region: region || null, district: district || null, created_by: user.id })
      .select()
      .single()

    if (orgErr || !org) throw orgErr ?? new Error('Haikuweza kuunda shirika')

    const { error: memberErr } = await admin
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: user.id, role: 'owner', invited_by: user.id })

    if (memberErr) {
      await admin.from('organizations').delete().eq('id', org.id)
      throw memberErr
    }

    return NextResponse.json({ organization: org }, { status: 201 })
  } catch (err) {
    console.error('[POST /organizations]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
