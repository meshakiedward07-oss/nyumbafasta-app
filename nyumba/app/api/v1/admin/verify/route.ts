import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/notifications/send'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Check admin role
    const admin = createAdminClient()
    const { data: adminUser } = await admin.from('users').select('role').eq('id', user.id).single()
    if (adminUser?.role !== 'admin') {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const { dalali_user_id, action, reason } = await req.json()
    if (!dalali_user_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Taarifa si sahihi' }, { status: 400 })
    }

    if (action === 'approve') {
      await admin.from('dalali_profiles').update({
        verification_status: 'verified',
        is_premium_verified: true,
        verification_approved_at: new Date().toISOString(),
        verification_rejected_reason: null,
      }).eq('user_id', dalali_user_id)

      await admin.from('notifications').insert({
        user_id: dalali_user_id,
        title: '🎉 Umeidhibitishwa!',
        body: 'Hongera! Akaunti yako imethibitishwa. Badge ya Verified imeongezwa kwenye wasifu wako.',
        type: 'verification_approved',
        is_read: false,
      })
      await sendPushToUser(
        dalali_user_id,
        '🎉 Umeidhibitishwa!',
        'Hongera! Akaunti yako imethibitishwa. Badge ya Verified imeongezwa.',
        '/dashboard/profile'
      )
    } else {
      if (!reason?.trim()) {
        return NextResponse.json({ error: 'Sababu ya kukataa inahitajika' }, { status: 400 })
      }
      await admin.from('dalali_profiles').update({
        verification_status: 'rejected',
        verification_rejected_reason: reason.trim(),
        verification_approved_at: null,
      }).eq('user_id', dalali_user_id)

      await admin.from('notifications').insert({
        user_id: dalali_user_id,
        title: '❌ Uthibitisho Ulikataliwa',
        body: `Ombi lako limekataliwa. Sababu: ${reason.trim()}. Wasilisha tena na hati sahihi.`,
        type: 'verification_rejected',
        is_read: false,
      })
      await sendPushToUser(
        dalali_user_id,
        '❌ Uthibitisho Ulikataliwa',
        `Ombi lako limekataliwa: ${reason.trim()}. Wasilisha tena.`,
        '/dashboard/verify'
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
