// Action: Handle subscription intent from dalali WhatsApp users.
// We can't initiate a payment from WhatsApp (security + UX), so we surface a deep
// link to the subscription page with plan details.

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

interface DalaliSubscriptionStatus {
  plan:       string | null
  status:     string | null
  expires_at: string | null
}

async function getDalaliSubscription(phone: string): Promise<DalaliSubscriptionStatus | null> {
  const digits = phone.replace(/\D/g, '')
  const last9  = digits.slice(-9)

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('phone', `%${last9}`)
    .eq('role', 'dalali')
    .limit(1)
    .maybeSingle()

  if (!user) return null

  const { data: sub } = await supabaseAdmin
    .from('subscriptions')
    .select('plan, status, expires_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return sub ?? { plan: null, status: null, expires_at: null }
}

export async function executeSubscriptionAction(phone?: string): Promise<string> {
  // Try to surface current subscription status if we know who they are
  if (phone) {
    const sub = await getDalaliSubscription(phone).catch(() => null)

    if (sub?.status === 'active') {
      const planLabel = sub.plan === 'premium' ? 'Premium' : 'Basic'
      const expiresDate = sub.expires_at
        ? new Date(sub.expires_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Haijulikani'

      return (
        `✅ *Subscription Yako Ipo Hai*\n\n` +
        `📦 Mpango: *${planLabel}*\n` +
        `📅 Inaisha: ${expiresDate}\n\n` +
        `Ili kurenew au kubadilisha mpango wako:\n` +
        `🔗 ${APP_URL}/dalali/subscription\n\n` +
        `_Unahitaji msaada? Niandikie hapa!_ 😊`
      )
    }

    if (sub) {
      // Has an account but subscription is expired/cancelled
      return buildSubscriptionOptions(true)
    }
  }

  return buildSubscriptionOptions(false)
}

function buildSubscriptionOptions(isExpired: boolean): string {
  const intro = isExpired
    ? `⚠️ *Subscription Yako Imekwisha*\n\nFanya upya ili uendelee kupost listings!\n\n`
    : `📦 *Mipango ya Dalali — NyumbaFasta*\n\n`

  return (
    intro +
    `🟢 *Basic — Tsh 10,000/mwezi*\n` +
    `   • Listings 5\n` +
    `   • Wasiliano wa msingi\n\n` +
    `⭐ *Premium — Tsh 25,000/mwezi*\n` +
    `   • Listings 20\n` +
    `   • Boost na verified badge\n` +
    `   • Analytics ya kina\n\n` +
    `Lipa kwa M-Pesa, Airtel Money, au Tigo Pesa:\n` +
    `🔗 ${APP_URL}/dalali/subscription\n\n` +
    `_Ingia akaunti yako na uchague mpango unaokufaa._`
  )
}
