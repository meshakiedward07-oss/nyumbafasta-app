import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

    // Verify password by re-authenticating
    const { data: userData } = await adminClient
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    const email = userData?.email ?? user.email
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

    // Sign out server-side session
    await supabase.auth.signOut()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
