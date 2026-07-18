import { formatPhoneNumber, sendTextMessage } from '@/lib/whatsapp/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

export async function notifyAdvertiserApproved(
  whatsapp: string,
  businessName: string,
  adType: string,
): Promise<void> {
  const typeLabel: Record<string, string> = {
    banner: 'Banner', search: 'Search Ad', nearby: 'Nearby Ad',
    video: 'Video Ad', featured: 'Featured Business',
  }
  const msg =
    `✅ *Tangazo Limeidhinishwa!*\n\n` +
    `Habari ${businessName}!\n\n` +
    `Tangazo lako la *${typeLabel[adType] ?? adType}* limeidhinishwa na timu ya NyumbaFasta.\n\n` +
    `Hatua inayofuata: *Lipa ili tangazo lako lianze kutumika*\n\n` +
    `👉 ${APP_URL}/advertising/dashboard`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAdvertiserRejected(
  whatsapp: string,
  businessName: string,
  reason: string,
): Promise<void> {
  const msg =
    `❌ *Tangazo Limekataliwa*\n\n` +
    `Habari ${businessName},\n\n` +
    `Samahani, tangazo lako limekataliwa kwa sababu ifuatayo:\n` +
    `_${reason}_\n\n` +
    `Unaweza kuwasiliana nasi au kuwasilisha tena baada ya kufanya marekebisho.\n\n` +
    `📞 Msaada: wa.me/255615261147`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAdvertiserPaymentSuccess(
  whatsapp: string,
  businessName: string,
  adType: string,
  expiresAt: string,
): Promise<void> {
  const typeLabel: Record<string, string> = {
    banner: 'Banner', search: 'Search Ad', nearby: 'Nearby Ad',
    video: 'Video Ad', featured: 'Featured Business',
  }
  const expiry = new Date(expiresAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
  const msg =
    `🎉 *Malipo Yamepokelewa! Tangazo Lako Linaendelea!*\n\n` +
    `Habari ${businessName}!\n\n` +
    `Tangazo lako la *${typeLabel[adType] ?? adType}* sasa *linaonekana* kwenye NyumbaFasta.\n\n` +
    `📅 Linakwisha: *${expiry}*\n\n` +
    `Shukrani kwa kuchagua NyumbaFasta Tanzania! 🇹🇿\n\n` +
    `👉 ${APP_URL}/advertising/dashboard`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAdvertiserRenewalReminder(
  whatsapp: string,
  businessName: string,
  adType: string,
  daysLeft: number,
): Promise<void> {
  const typeLabel: Record<string, string> = {
    banner: 'Banner', search: 'Search Ad', nearby: 'Nearby Ad',
    video: 'Video Ad', featured: 'Featured Business',
  }
  const msg =
    `⏰ *Tangazo Lako Linakaribia Kwisha — Siku ${daysLeft}!*\n\n` +
    `Habari ${businessName},\n\n` +
    `Tangazo lako la *${typeLabel[adType] ?? adType}* litaisha baada ya siku *${daysLeft}*.\n\n` +
    `Huisha sasa ili uendelee kuonekana na wateja!\n\n` +
    `👉 ${APP_URL}/advertising/dashboard`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAccountApproved(
  whatsapp: string,
  businessName: string,
): Promise<void> {
  const msg =
    `✅ *Akaunti Yako Imeidhinishwa!*\n\n` +
    `Hongera ${businessName}!\n\n` +
    `Akaunti yako ya NyumbaFasta Ads imepitiwa na *imeidhinishwa*. Sasa unaweza kuunda matangazo yako.\n\n` +
    `👉 Unda tangazo lako la kwanza sasa:\n${APP_URL}/advertising/new`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAccountRejected(
  whatsapp: string,
  businessName: string,
  reason?: string,
): Promise<void> {
  const msg =
    `❌ *Maombi ya Akaunti Yameshughulikiwa*\n\n` +
    `Habari ${businessName},\n\n` +
    `Samahani, akaunti yako ya NyumbaFasta Ads haikuidhinishwa kwa sasa.\n` +
    (reason ? `Sababu: _${reason}_\n\n` : '\n') +
    `Wasiliana nasi kwa maelezo zaidi:\n📞 wa.me/255665831694`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyAccountSuspended(
  whatsapp: string,
  businessName: string,
  reason?: string,
): Promise<void> {
  const msg =
    `⚠️ *Akaunti Yako Imesimamishwa*\n\n` +
    `Habari ${businessName},\n\n` +
    `Akaunti yako ya NyumbaFasta Ads imesimamishwa kwa muda.\n` +
    (reason ? `Sababu: _${reason}_\n\n` : '\n') +
    `Wasiliana nasi kwa msaada:\n📞 wa.me/255665831694`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}

export async function notifyWaitingListSlotOpen(
  whatsapp: string,
  businessName: string,
  adType: string,
  region: string,
): Promise<void> {
  const typeLabel: Record<string, string> = {
    banner: 'Banner', search: 'Search Ad', nearby: 'Nearby Ad',
    video: 'Video Ad', featured: 'Featured Business',
  }
  const msg =
    `🟢 *Nafasi Imefunguka! — ${typeLabel[adType] ?? adType}*\n\n` +
    `Habari ${businessName}!\n\n` +
    `Nafasi ya tangazo la *${typeLabel[adType] ?? adType}* kwa *${region}* sasa *inapatikana!*\n\n` +
    `Haraka uwasilishe tangazo lako kabla nafasi haijakwisha.\n\n` +
    `👉 ${APP_URL}/advertising/new`
  try {
    await sendTextMessage(formatPhoneNumber(whatsapp), msg)
  } catch { /* non-fatal */ }
}
