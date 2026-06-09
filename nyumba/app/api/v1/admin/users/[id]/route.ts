import { createAdminClient, createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'
import { auditLog } from '@/lib/security/auditLog'
import { getClientIp } from '@/lib/security/rateLimit'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// PATCH — suspend au activate user
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { action } = await req.json()
    if (!['suspend', 'activate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('users')
      .update({ is_active: action === 'activate' })
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await auditLog({
      action: action === 'suspend' ? 'user_suspended' : 'user_activated',
      user_id: admin.id,
      target_id: params.id,
      target_type: 'user',
      ip_address: getClientIp(req),
      severity: action === 'suspend' ? 'warning' : 'info',
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — futa user kabisa kwa admin
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (params.id === admin.id) {
      return NextResponse.json({ error: 'Huwezi kufuta akaunti yako mwenyewe' }, { status: 400 })
    }

    let reason: string | undefined
    let notify = false
    try {
      const body = await req.json()
      reason = body.reason
      notify = body.notify === true
    } catch { /* body optional */ }

    const adminClient = createAdminClient()

    // Fetch dalali info before deletion (for notification and WhatsApp link)
    const { data: targetUser } = await adminClient
      .from('users')
      .select('full_name')
      .eq('id', params.id)
      .single()

    const { data: dalaliProfile } = await adminClient
      .from('dalali_profiles')
      .select('whatsapp_number')
      .eq('user_id', params.id)
      .maybeSingle()

    // Send notification BEFORE deletion (so the row still exists)
    if (notify && reason) {
      await adminClient.from('notifications').insert({
        user_id:  params.id,
        title:    '🚫 Akaunti Yako Imefutwa',
        body:     `Akaunti yako kwenye NyumbaFasta imefutwa na admin. Sababu: ${reason}`,
        type:     'account_deleted',
        is_read:  false,
        data:     { reason },
      })
    }

    // Call RPC to delete everything
    const { error: rpcError } = await adminClient.rpc('delete_user_account', {
      target_user_id: params.id,
      reason:         reason ?? 'Admin deletion',
      deleted_by_id:  admin.id,
    })

    if (rpcError) {
      // Fallback: direct delete if RPC not available yet
      const { error: dbError } = await adminClient.from('users').delete().eq('id', params.id)
      if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
      await adminClient.auth.admin.deleteUser(params.id)
    }

    // Log admin action
    await adminClient.from('admin_logs').insert({
      admin_id:  admin.id,
      action:    'delete_user',
      target_id: params.id,
      reason:    reason ?? null,
      details: {
        full_name:       targetUser?.full_name,
        whatsapp_number: dalaliProfile?.whatsapp_number,
        notify,
      },
    }).then(() => {}) // non-blocking, ignore error if admin_logs table not yet created

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
