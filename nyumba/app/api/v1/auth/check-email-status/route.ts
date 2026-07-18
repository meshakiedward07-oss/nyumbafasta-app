import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Called by the login page when signInWithPassword returns "invalid login credentials"
// to distinguish an unconfirmed email from genuinely wrong credentials.
// Returns { exists, confirmed } — no password info exposed.
//
// NOTE: public.users.email is not populated by the DB trigger — we query
// auth.admin directly to avoid always returning { exists: false }.
export async function POST(req: NextRequest) {
  let email: string
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  } catch {
    return NextResponse.json({ exists: false, confirmed: false })
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ exists: false, confirmed: false })
  }

  try {
    const admin = createAdminClient()

    // Search auth.admin with pagination — fall back to public.users.email if not found
    let authUser: { id: string; email_confirmed_at: string | null } | null = null

    let page = 1
    let hasMore = true
    while (hasMore && !authUser) {
      const { data: listData } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      const users = listData?.users ?? []
      authUser = users.find(u => u.email?.toLowerCase() === email) ?? null
      hasMore = users.length === 1000
      page++
      if (page > 10) break // safety cap: 10,000 users max scan
    }

    // If not found via auth.admin list, try public.users.email (populated after migration)
    if (!authUser) {
      const { data: publicRow } = await admin
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      if (publicRow?.id) {
        const { data: byId } = await admin.auth.admin.getUserById(publicRow.id)
        if (byId?.user?.email?.toLowerCase() === email) {
          authUser = {
            id: byId.user.id,
            email_confirmed_at: byId.user.email_confirmed_at ?? null,
          }
        }
      }
    }

    if (!authUser) return NextResponse.json({ exists: false, confirmed: false })

    return NextResponse.json({
      exists: true,
      confirmed: !!authUser.email_confirmed_at,
    })
  } catch {
    return NextResponse.json({ exists: false, confirmed: false })
  }
}
