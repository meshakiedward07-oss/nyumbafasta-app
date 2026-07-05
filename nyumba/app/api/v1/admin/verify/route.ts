import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/notifications/send'

// Inline the same username-generation logic used by /api/v1/profile/username/auto-generate
function nameToSlug(fullName: string): string {
  return fullName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 16) || 'dalali'
}
function randomSuffix(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function ensureUsername(admin: ReturnType<typeof createAdminClient>, userId: string, fullName: string): Promise<string | null> {
  const { data: existing } = await admin.from('users').select('username').eq('id', userId).single()
  if (existing?.username) return existing.username as string

  const base = nameToSlug(fullName ?? '')
  const { data: reserved } = await admin.from('reserved_usernames').select('username')
  const reservedSet = new Set((reserved ?? []).map((r: { username: string }) => r.username))

  for (let i = 0; i < 10; i++) {
    const candidate = `${base}_${randomSuffix()}`
    if (reservedSet.has(candidate)) continue
    const { data: taken } = await admin.from('users').select('id').eq('username', candidate).maybeSingle()
    if (taken) continue
    const { error } = await admin.from('users').update({ username: candidate, username_changed_at: new Date().toISOString() }).eq('id', userId)
    if (!error) return candidate
  }
  return null
}

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
      // Fetch dalali name and ensure they have a username before approval
      const { data: dalaliUser } = await admin.from('users').select('full_name, username').eq('id', dalali_user_id).single()
      const username = dalaliUser?.username
        ?? await ensureUsername(admin, dalali_user_id, (dalaliUser as { full_name?: string } | null)?.full_name ?? '')

      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
      const micrositeUrl = username ? `${APP_URL}/agent/${username}` : null

      await admin.from('dalali_profiles').update({
        verification_status: 'approved',
        is_premium_verified: true,
        verification_approved_at: new Date().toISOString(),
        verification_rejected_reason: null,
      }).eq('user_id', dalali_user_id)

      const notifBody = micrositeUrl
        ? `Hongera! Akaunti yako imethibitishwa. Ukurasa wako wa umma uko tayari: ${micrositeUrl}`
        : 'Hongera! Akaunti yako imethibitishwa. Badge ya Verified imeongezwa kwenye wasifu wako.'

      await admin.from('notifications').insert({
        user_id: dalali_user_id,
        title: '🎉 Umeidhibitishwa!',
        body: notifBody,
        type: 'verification_approved',
        is_read: false,
      })
      await sendPushToUser(
        dalali_user_id,
        '🎉 Umeidhibitishwa!',
        micrositeUrl ? `Ukurasa wako uko tayari: ${micrositeUrl}` : 'Hongera! Akaunti yako imethibitishwa.',
        '/dashboard'
      )

      // Purge ISR cache so the microsite is immediately accessible
      if (username) revalidatePath(`/agent/${username}`)
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
