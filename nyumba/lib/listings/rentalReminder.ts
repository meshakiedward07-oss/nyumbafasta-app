import { createHmac } from 'crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// ── Secure token for one-click WhatsApp mark-taken link ───────────────────────
// Uses HMAC-SHA256 with CRON_SECRET so the token can't be forged without the key.

export function generateMarkTakenToken(listingId: string, unlockId: string): string {
  const secret = process.env.CRON_SECRET ?? 'nyumbafasta'
  return createHmac('sha256', secret).update(`${listingId}:${unlockId}`).digest('hex')
}

export function verifyMarkTakenToken(listingId: string, unlockId: string, token: string): boolean {
  return token === generateMarkTakenToken(listingId, unlockId)
}

// ── Immediate WhatsApp notification when client unlocks dalali's contact ───────
// Call this (non-blocking) right after a contact_unlock is confirmed as completed.

export async function notifyDalaliNewUnlock(params: {
  dalaliId: string
  listingId: string
  listingLabel: string  // e.g. "Chumba – Kinondoni"
}): Promise<void> {
  const admin = getAdmin()

  const { data: dalali } = await admin
    .from('users')
    .select('full_name, phone, dalali_profiles(whatsapp_number)')
    .eq('id', params.dalaliId)
    .single()

  if (!dalali) return

  const waProfile = dalali.dalali_profiles as unknown as { whatsapp_number: string | null } | null
  const rawPhone = waProfile?.whatsapp_number ?? dalali.phone
  if (!rawPhone) return

  await sendTextMessage(
    formatPhoneNumber(rawPhone),
    `🔓 Mteja Amefungua Mawasiliano Yako — NyumbaFasta\n\n` +
    `Habari ${dalali.full_name}!\n\n` +
    `Mteja amefungua namba yako kupitia listing:\n` +
    `🏠 *${params.listingLabel}*\n\n` +
    `Anaweza kukupigia simu au kukutumia WhatsApp sasa hivi.\n\n` +
    `Jibu haraka ili usipoteze mteja! ⚡\n\n` +
    `Angalia: ${APP_URL}/dashboard/listings`
  ).catch(err => console.error('[RentalReminder] notifyDalaliNewUnlock failed:', err))
}

// ── 24-hour rental reminder batch ────────────────────────────────────────────
// Finds completed unlocks older than 24 hours that haven't received a reminder.
// Should be called from the daily cron.

export async function sendRentalReminders(): Promise<{
  checked: number
  reminded: number
  errors: string[]
}> {
  const admin = getAdmin()
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: dueUnlocks, error } = await admin
    .from('contact_unlocks')
    .select('id, listing_id, dalali_id')
    .lte('created_at', oneDayAgo)
    .is('reminder_sent_at', null)
    .eq('status', 'completed')
    .limit(50)

  if (error) {
    console.error('[RentalReminder] Query failed:', error.message)
    return { checked: 0, reminded: 0, errors: [error.message] }
  }
  if (!dueUnlocks?.length) return { checked: 0, reminded: 0, errors: [] }

  console.log(`[RentalReminder] Found ${dueUnlocks.length} due reminders`)

  let reminded = 0
  const errors: string[] = []

  for (const unlock of dueUnlocks) {
    try {
      const [listingRes, dalaliRes] = await Promise.all([
        admin.from('listings').select('id, type, district, title, status').eq('id', unlock.listing_id).single(),
        admin.from('users').select('full_name, phone, dalali_profiles(whatsapp_number)').eq('id', unlock.dalali_id).single(),
      ])

      const listing = listingRes.data
      const dalali = dalaliRes.data

      if (!listing || !dalali) {
        // Mark as reminded to remove from future cron runs
        await admin.from('contact_unlocks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', unlock.id)
        continue
      }

      // Skip if listing already taken/expired — mark reminder sent so it won't reappear
      if (listing.status !== 'active') {
        await admin.from('contact_unlocks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', unlock.id)
        continue
      }

      const waProfile = dalali.dalali_profiles as unknown as { whatsapp_number: string | null } | null
      const rawPhone = waProfile?.whatsapp_number ?? dalali.phone
      if (!rawPhone) continue

      const listingLabel = listing.title ?? `${listing.type} – ${listing.district}`
      const markTakenUrl =
        `${APP_URL}/api/v1/listings/${listing.id}/mark-taken` +
        `?unlock=${unlock.id}` +
        `&token=${generateMarkTakenToken(listing.id, unlock.id)}`

      const sent = await sendTextMessage(
        formatPhoneNumber(rawPhone),
        `🔔 Ukumbusho — NyumbaFasta\n\n` +
        `Habari ${dalali.full_name}!\n\n` +
        `Jana mteja alifungua mawasiliano ya listing yako:\n` +
        `🏠 *${listingLabel}*\n\n` +
        `Je, nyumba hii imeshapangishwa?\n\n` +
        `✅ *Ndio, imepangishwa* — Bonyeza hapa kuzima listing:\n${markTakenUrl}\n\n` +
        `❌ *Bado inapatikana* — Listing itaendelea kuonekana. Hakuna kitu cha kufanya.\n\n` +
        `Au nenda dashboard yako:\n${APP_URL}/dashboard/listings\n\n` +
        `_Asante kwa kutumia NyumbaFasta!_ 🏠`
      )

      if (sent) {
        await admin.from('contact_unlocks').update({ reminder_sent_at: new Date().toISOString() }).eq('id', unlock.id)
        reminded++
        console.log(`[RentalReminder] Reminded dalali ${dalali.full_name} for listing ${listing.id}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`unlock ${unlock.id}: ${msg}`)
      console.error('[RentalReminder] Error processing unlock:', unlock.id, err)
    }
  }

  return { checked: dueUnlocks.length, reminded, errors }
}

// ── Mark listing as taken via token link ──────────────────────────────────────
// Used by the one-click WhatsApp link. Does NOT go through session auth.

export async function markListingAsTakenByToken(
  listingId: string,
  unlockId: string
): Promise<{ success: boolean; alreadyTaken?: boolean; error?: string }> {
  const admin = getAdmin()

  // Check if listing exists and is still active
  const { data: listing } = await admin
    .from('listings')
    .select('id, status')
    .eq('id', listingId)
    .single()

  if (!listing) return { success: false, error: 'Listing haipatikani' }
  if (listing.status === 'taken') return { success: true, alreadyTaken: true }
  if (listing.status !== 'active') return { success: false, error: 'Listing haiwezi kubadilishwa' }

  // Mark listing as taken
  const { error } = await admin
    .from('listings')
    .update({ status: 'taken' })
    .eq('id', listingId)

  if (error) return { success: false, error: error.message }

  // Prevent future reminder for this unlock
  await admin
    .from('contact_unlocks')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', unlockId)
    .is('reminder_sent_at', null)

  // Notify clients who saved this listing (non-fatal)
  Promise.resolve(
    admin
      .from('saved_listings')
      .select('client_id')
      .eq('listing_id', listingId)
  ).then(({ data: saved }) => {
    if (!saved?.length) return
    return admin.from('notifications').insert(
      saved.map(s => ({
        user_id: s.client_id,
        title: '🏠 Listing Imepangishwa',
        body: 'Listing uliyoipenda imeshapangishwa — tafuta nyingine kama yake.',
        type: 'listing_taken',
        is_read: false,
      }))
    )
  }).catch(err => console.error('[RentalReminder] saved_listings notify failed (non-fatal):', err))

  console.log(`[RentalReminder] Listing ${listingId} marked taken via WhatsApp link`)
  return { success: true }
}
