import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/fundi/me
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('id, full_name, phone, role').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const [fundiRes, kycRes] = await Promise.all([
      admin.from('fundi_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      admin.from('fundi_kyc').select('*').eq('fundi_user_id', user.id).order('submitted_at', { ascending: false }),
    ])

    return NextResponse.json({ user: profile, fundi: fundiRes.data, kyc: kycRes.data ?? [] })
  } catch (err) {
    console.error('[GET /fundi/me]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// PATCH /api/v1/fundi/me
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { full_name, phone, business_name, category, specialty, location, bio, experience_years, is_available } = body

    const userUpdates: Record<string, unknown> = {}
    if (full_name !== undefined) userUpdates.full_name = full_name?.trim() || null
    if (phone     !== undefined) userUpdates.phone     = phone?.trim()    || null
    if (Object.keys(userUpdates).length > 0) {
      await admin.from('users').update(userUpdates).eq('id', user.id)
    }

    const now = new Date().toISOString()
    const profileUpdates: Record<string, unknown> = { user_id: user.id, updated_at: now }
    if (business_name    !== undefined) profileUpdates.business_name    = business_name?.trim()  || null
    if (category         !== undefined) profileUpdates.category         = category
    if (specialty        !== undefined) profileUpdates.specialty        = specialty?.trim()       || null
    if (location         !== undefined) profileUpdates.location         = location?.trim()        || null
    if (bio              !== undefined) profileUpdates.bio              = bio?.trim()             || null
    if (experience_years !== undefined) profileUpdates.experience_years = experience_years        || null
    if (is_available     !== undefined) profileUpdates.is_available     = is_available

    const { data: updated, error } = await admin.from('fundi_profiles')
      .upsert(profileUpdates, { onConflict: 'user_id' })
      .select().single()
    if (error) throw error

    return NextResponse.json({ fundi: updated })
  } catch (err) {
    console.error('[PATCH /fundi/me]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
