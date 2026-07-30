// Server-only — shared broadcast recipient resolution + send logic
// Used by both the immediate-send POST handler and the scheduled cron.
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

export type Recipient = { name: string; phone: string }

// ── Resolve recipients from a broadcast target ────────────────────────────────

export async function resolveRecipients(
  target: string,
  phones?: string[],
): Promise<{ recipients: Recipient[]; error?: string }> {

  if (target === 'specific') {
    if (!phones?.length) return { recipients: [], error: 'Nambari za simu hazikutolewa' }
    return { recipients: phones.map((p) => ({ name: 'Mtumiaji', phone: p })) }
  }

  if (target === 'all_clients' || target === 'active_clients') {
    let clientIds: string[] | null = null

    if (target === 'active_clients') {
      const { data: unlocks } = await supabaseAdmin
        .from('contact_unlocks')
        .select('client_id')
        .eq('status', 'completed')
        .limit(5000)
      clientIds = [...new Set((unlocks ?? []).map((u) => u.client_id as string))]
      if (!clientIds.length) return { recipients: [], error: 'Hakuna wateja waliofanya unlock bado' }
    }

    let q = supabaseAdmin.from('users').select('full_name, phone').eq('role', 'client').not('phone', 'is', null)
    if (clientIds) q = q.in('id', clientIds)
    const { data } = await q.limit(500)
    const recipients = (data ?? [])
      .map((u) => ({ name: u.full_name ?? 'Mteja', phone: u.phone ?? '' }))
      .filter((r) => r.phone)
    return { recipients }
  }

  // Dalali targets
  let q = supabaseAdmin
    .from('users')
    .select('full_name, phone, dalali_profiles(whatsapp_number)')
    .eq('role', 'dalali')
    .eq('is_active', true)

  if (target === 'new_dalali') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    q = q.gte('created_at', weekAgo)
  } else if (target === 'active_dalali') {
    const { data: subs } = await supabaseAdmin
      .from('subscriptions').select('dalali_id').eq('status', 'active')
    const ids = (subs ?? []).map((s) => s.dalali_id)
    if (!ids.length) return { recipients: [], error: 'Hakuna madalali wenye subscription inayoendelea' }
    q = q.in('id', ids)
  }

  const { data } = await q.limit(500)
  const recipients = (data ?? []).map((u) => {
    const profile = Array.isArray(u.dalali_profiles) ? u.dalali_profiles[0] : u.dalali_profiles
    const phone = (profile as { whatsapp_number?: string } | null)?.whatsapp_number ?? u.phone ?? ''
    return { name: u.full_name ?? 'Dalali', phone }
  }).filter((r) => r.phone)
  return { recipients }
}

// ── Build personalised message text ──────────────────────────────────────────

export function buildMessage(recipientName: string, message: string, tone: string): string {
  const firstName = recipientName.split(' ')[0]
  let prefix = ''
  if (tone === 'personal') prefix = `Habari ${firstName}! 😊\n\n`
  else if (tone === 'formal') prefix = `Kwa heshima, ${firstName},\n\n`
  else if (tone === 'urgent') prefix = `MUHIMU — ${firstName},\n\n`
  return (prefix + message.trim())
    .replace(/\{jina\}/gi, firstName)
    .replace(/\{name\}/gi, firstName)
}

// ── Send to all recipients and update DB record ───────────────────────────────

export async function executeBroadcast(
  broadcastId: string,
  recipients: Recipient[],
  message: string,
  tone: string,
): Promise<{ sentCount: number; failedCount: number }> {
  let sentCount = 0
  let failedCount = 0

  for (const recipient of recipients) {
    try {
      const phone = formatPhoneNumber(recipient.phone)
      if (!phone) { failedCount++; continue }
      await sendTextMessage(phone, buildMessage(recipient.name, message, tone))
      sentCount++
    } catch (err) {
      console.error('[Broadcast] send failed:', err)
      failedCount++
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  await supabaseAdmin
    .from('whatsapp_broadcasts')
    .update({
      sent_count:   sentCount,
      failed_count: failedCount,
      status:       failedCount === recipients.length ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', broadcastId)

  return { sentCount, failedCount }
}
