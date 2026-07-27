import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/fundi/kyc
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    const { data } = await admin.from('fundi_kyc').select('*').eq('fundi_user_id', user.id).order('submitted_at', { ascending: false })
    return NextResponse.json({ kyc: data ?? [] })
  } catch (err) {
    console.error('[GET /fundi/kyc]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/fundi/kyc
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: userProfile } = await admin.from('users').select('role, full_name').eq('id', user.id).single()
    if (userProfile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { document_type, document_url, document_name } = body
    if (!document_url?.trim()) return NextResponse.json({ error: 'Kiungo cha hati kinahitajika' }, { status: 400 })

    const { data: kyc, error } = await admin.from('fundi_kyc').insert({
      fundi_user_id: user.id,
      document_type: document_type || 'other',
      document_url:  document_url.trim(),
      document_name: document_name?.trim() || null,
      status:        'pending',
    }).select().single()
    if (error) throw error

    await admin.from('fundi_profiles').update({ kyc_status: 'pending', updated_at: new Date().toISOString() }).eq('user_id', user.id)

    ;(async () => {
      try {
        const { data: admins } = await admin.from('users').select('id').in('role', ['admin', 'staff']).eq('is_active', true)
        if (admins?.length) {
          await admin.from('notifications').insert(admins.map(a => ({
            user_id: a.id,
            type:    'fundi_kyc_submitted',
            title:   'Fundi: Hati Mpya ya KYC',
            body:    `${userProfile?.full_name ?? 'Fundi'} amewasilisha hati inayosubiri ukaguzi.`,
            data:    { fundi_user_id: user.id, kyc_id: kyc.id },
            read:    false,
          })))
        }
      } catch { /* non-fatal */ }
    })().catch(() => {})

    return NextResponse.json({ kyc }, { status: 201 })
  } catch (err) {
    console.error('[POST /fundi/kyc]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
