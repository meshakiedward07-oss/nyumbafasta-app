import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/v1/admin/fundi
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (!['admin', 'staff'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const url       = req.nextUrl
    const kycStatus = url.searchParams.get('kyc_status')
    const search    = url.searchParams.get('search')

    let query = admin
      .from('fundi_profiles')
      .select('*, user:users(id, full_name, phone, created_at)')
      .order('created_at', { ascending: false })

    if (kycStatus && kycStatus !== 'all') query = query.eq('kyc_status', kycStatus)
    if (search?.trim()) {
      // Filter happens client-side — Supabase doesn't join-filter easily; fetch all and filter
    }

    const { data, error } = await query
    if (error) throw error

    const fundiUserIds = (data ?? []).map((f: { user_id: string }) => f.user_id)
    const kycMap: Record<string, unknown[]> = {}
    if (fundiUserIds.length > 0) {
      const { data: kyc } = await admin.from('fundi_kyc').select('*').in('fundi_user_id', fundiUserIds).order('submitted_at', { ascending: false })
      for (const k of kyc ?? []) {
        const ki = k as { fundi_user_id: string }
        if (!kycMap[ki.fundi_user_id]) kycMap[ki.fundi_user_id] = []
        kycMap[ki.fundi_user_id].push(k)
      }
    }

    let result = (data ?? []).map((f: { user_id: string }) => ({ ...f, kyc_documents: kycMap[f.user_id] ?? [] }))
    if (search?.trim()) {
      const q = search.toLowerCase()
      result = result.filter((f: Record<string, unknown>) => {
        const u = f.user as { full_name: string | null; phone: string | null } | null
        return (
          u?.full_name?.toLowerCase().includes(q) ||
          u?.phone?.includes(q) ||
          (f.business_name as string | null)?.toLowerCase().includes(q)
        )
      })
    }

    return NextResponse.json({ fundi: result })
  } catch (err) {
    console.error('[GET /admin/fundi]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
