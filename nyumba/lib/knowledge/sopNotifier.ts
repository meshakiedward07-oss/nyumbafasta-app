import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_NUMBER ?? '255615261147'

// Called after a SOP's last_reviewed_at is updated.
// Counts acks that are now stale and pings the admin via WhatsApp.
export async function notifySopUpdated(
  sopId:      string,
  newVersion: string,  // the new last_reviewed_at value
): Promise<void> {
  if (!ADMIN_PHONE) return

  // Fetch article title
  let title = 'SOP'
  try {
    const { data } = await supabaseAdmin
      .from('knowledge_base')
      .select('title')
      .eq('id', sopId)
      .single()
    if (data?.title) title = data.title
  } catch { /* non-fatal */ }

  // Count acks that no longer match the new version
  let staleCount = 0
  try {
    const { count } = await supabaseAdmin
      .from('sop_acknowledgements')
      .select('id', { count: 'exact', head: true })
      .eq('sop_id', sopId)
      .neq('sop_version', newVersion)
    staleCount = count ?? 0
  } catch { /* table may not exist yet */ }

  const lines: string[] = [
    `📋 *SOP Imesasishwa — NyumbaFasta*`,
    ``,
    `"${title}" imepata mapitio mapya.`,
  ]

  if (staleCount > 0) {
    lines.push(``)
    lines.push(`⚠️ Watumishi *${staleCount}* wanahitaji kuthibitisha upya.`)
  } else {
    lines.push(``)
    lines.push(`✅ Hakuna wathibitisho wa awali — wote watahitaji kuthibitisha.`)
  }

  lines.push(``)
  lines.push(`👉 ${APP_URL}/admin/knowledge`)

  try {
    await sendTextMessage(formatPhoneNumber(ADMIN_PHONE), lines.join('\n'))
  } catch (err) {
    console.error('[sopNotifier] WhatsApp send failed:', err)
  }
}
