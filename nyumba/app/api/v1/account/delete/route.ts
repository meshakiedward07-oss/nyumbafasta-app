import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { auditLog } from '@/lib/security/auditLog'
import { getClientIp } from '@/lib/security/rateLimit'
import { isSuperadmin } from '@/lib/security/superadmin'

const DELETION_REASONS = [
  'Situmii tena',
  'Ninabadilisha platform',
  'Matatizo ya kiufundi',
  'Sababu nyingine',
]

export async function POST(req: NextRequest) {
  try {
    const supabase  = await createClient()
    const adminClient = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { password, reason } = await req.json()

    if (!password) {
      return NextResponse.json({ error: 'Nenosiri linahitajika' }, { status: 400 })
    }

    // Superadmin account cannot be self-deleted
    if (isSuperadmin(user.email)) {
      return NextResponse.json({ error: 'Akaunti hii inalindwa na haiwezi kufutwa' }, { status: 403 })
    }

    // email lives in auth.users, not public.users
    const email = user.email
    if (!email) {
      return NextResponse.json({ error: 'Barua pepe haipatikani — tumia Google sign-in kufuta akaunti' }, { status: 400 })
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      return NextResponse.json({ error: 'Nenosiri si sahihi' }, { status: 401 })
    }

    const safeReason = DELETION_REASONS.includes(reason) ? reason : (reason?.slice(0, 200) ?? 'Hakuna sababu')

    // Call RPC to delete everything
    const { error: rpcError } = await adminClient.rpc('delete_user_account', {
      target_user_id: user.id,
      reason:         safeReason,
      deleted_by_id:  user.id,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    await auditLog({
      action: 'account_deleted',
      user_id: user.id,
      target_id: user.id,
      target_type: 'user',
      metadata: { self_initiated: true },
      ip_address: getClientIp(req),
      severity: 'warning',
    })

    // Sign out server-side session
    await supabase.auth.signOut()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
