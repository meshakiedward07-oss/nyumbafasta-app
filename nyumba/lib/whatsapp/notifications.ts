import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'

function fmt(n: number): string {
  return n.toLocaleString('en-TZ')
}

// ── Proactive notification functions ──────────────────────────────────────

export async function notifyNewLead(
  dalaliPhone: string,
  clientName: string,
  requirement: string,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const message =
    `Kiongozi Kipya! 🎉\n\n` +
    `Mteja *${clientName}* anatafuta:\n${requirement}\n\n` +
    `Wasiliana nao haraka ili usipoteze fursa!\n\n` +
    `Angalia dashboard yako:\n` +
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'}/dashboard`
  return sendTextMessage(to, message)
}

export async function notifySubscriptionExpiring(
  dalaliPhone: string,
  daysLeft: number,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const urgency = daysLeft <= 1 ? '🚨 LEO INAISHA!' : daysLeft <= 3 ? '⚠️ Karibu kuisha!' : 'ℹ️ Kumbusho'
  const message =
    `${urgency}\n\n` +
    `Subscription yako ya NyumbaFasta itakwisha siku *${daysLeft}* ${daysLeft === 1 ? 'LEO' : 'zinazokuja'}.\n\n` +
    `Fanya upya sasa usipoteze listings na wateja wako:\n` +
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'}/dashboard/subscription`
  return sendTextMessage(to, message)
}

export async function notifyListingApproved(
  dalaliPhone: string,
  listingTitle: string,
  listingId?: string,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const link = listingId ? `${appUrl}/listings/${listingId}` : `${appUrl}/dashboard/listings`
  const message =
    `Listing Imeidhinishwa! ✅\n\n` +
    `Habari njema! Listing yako *"${listingTitle}"* imeidhinishwa na inaonekana sasa kwenye NyumbaFasta!\n\n` +
    `Wateja wataanza kuona listing yako mara moja. 🏠\n\n` +
    `Angalia hapa:\n${link}`
  return sendTextMessage(to, message)
}

export async function notifyPaymentReceived(
  dalaliPhone: string,
  amount: number,
  type: string,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const typeLabel: Record<string, string> = {
    subscription: 'Subscription',
    boost:        'Boost ya Listing',
    unlock:       'Ufunguzi wa Contact',
    extra:        'Listings za Ziada',
  }
  const label = typeLabel[type] ?? type
  const message =
    `Malipo Yamefanikiwa! ✅\n\n` +
    `Malipo ya *Tsh ${fmt(amount)}* kwa ${label} yamepokewa.\n\n` +
    `Asante kwa kutumia NyumbaFasta! 🙏\n\n` +
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'}/dashboard`
  return sendTextMessage(to, message)
}

export async function notifyListingRejected(
  dalaliPhone: string,
  listingTitle: string,
  reason?: string,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const reasonText = reason ? `\n\nSababu: ${reason}` : ''
  const message =
    `Listing Imekataliwa ❌\n\n` +
    `Listing yako *"${listingTitle}"* imekataliwa na admin.${reasonText}\n\n` +
    `Rekebisha na utume tena:\n` +
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'}/dashboard/listings`
  return sendTextMessage(to, message)
}

export async function notifyBoostActivated(
  dalaliPhone: string,
  listingTitle: string,
  weeks: number,
): Promise<boolean> {
  const to = formatPhoneNumber(dalaliPhone)
  const message =
    `Boost Imewashwa! 🚀\n\n` +
    `Listing yako *"${listingTitle}"* sasa ipo juu ya matokeo kwa wiki *${weeks}*!\n\n` +
    `Wateja zaidi wataona listing yako. 🎉`
  return sendTextMessage(to, message)
}
