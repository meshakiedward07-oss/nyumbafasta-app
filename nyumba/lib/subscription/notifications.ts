import { createAdminClient } from '@/lib/supabase/server'
import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

// ── Internal helpers ───────────────────────────────────────────────────────────

async function getOrgOwner(orgId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_members')
    .select('user_id, user:users(id, phone, full_name)')
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .maybeSingle()
  return (data?.user as unknown as { id: string; phone: string | null; full_name: string | null } | null) ?? null
}

async function dispatch(
  userId: string,
  phone: string | null,
  waMessage: string,
  type: string,
  title: string,
  body: string,
) {
  const admin = createAdminClient()
  if (phone) {
    await sendTextMessage(formatPhoneNumber(phone), waMessage).catch(() => {})
  }
  try {
    await admin.from('notifications').insert({ user_id: userId, type, title, body, is_read: false })
  } catch { /* non-fatal */ }
}

// ── Public notification functions ──────────────────────────────────────────────

export async function notifyOrgInvoiceCreated(
  orgId: string,
  amount: number,
  planName: string,
): Promise<void> {
  const owner = await getOrgOwner(orgId)
  if (!owner) return
  const amtStr = `Tsh ${amount.toLocaleString()}`
  await dispatch(
    owner.id,
    owner.phone,
    `*NyumbaFasta — Ankara Mpya* 🧾\n\nAnkara ya *${amtStr}* imeundwa kwa mpango wa *${planName}*.\n\nTuma malipo kwa M-Pesa / Airtel / benki, kisha pakia picha ya risiti hapa:\n${APP_URL}/property/usajili`,
    'org_invoice_created',
    '🧾 Ankara Mpya ya Usajili',
    `Ankara ya ${amtStr} kwa mpango ${planName} imeundwa. Pakia ushahidi wa malipo.`,
  )
}

export async function notifyOrgInvoiceConfirmed(
  orgId: string,
  planName: string,
): Promise<void> {
  const owner = await getOrgOwner(orgId)
  if (!owner) return
  await dispatch(
    owner.id,
    owner.phone,
    `*NyumbaFasta — Usajili Umesasishwa!* ✅\n\nHongera! Malipo yako yamethibitishwa.\nMpango wako sasa ni *${planName}* na umewashwa.\n\n${APP_URL}/property/dashboard`,
    'org_invoice_confirmed',
    '✅ Usajili Umesasishwa',
    `Malipo yamethibitishwa. Mpango wa ${planName} umewashwa.`,
  )
}

export async function notifyOrgInvoiceVoided(
  orgId: string,
  reason: string,
): Promise<void> {
  const owner = await getOrgOwner(orgId)
  if (!owner) return
  await dispatch(
    owner.id,
    owner.phone,
    `*NyumbaFasta — Ankara Imebatilishwa* ❌\n\nAnkara yako imebatilishwa.\nSababu: ${reason}\n\nUnahitaji msaada? ${APP_URL}/property/usajili`,
    'org_invoice_voided',
    '❌ Ankara Imebatilishwa',
    `Ankara imebatilishwa. Sababu: ${reason}`,
  )
}
