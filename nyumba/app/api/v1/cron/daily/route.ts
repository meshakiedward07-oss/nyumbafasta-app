import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { runGoogleMapsRunner } from '@/lib/agent/runners'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS,
} from '@/lib/agent/regions'
import { monitorDalaliAccounts } from '@/lib/dalali/accountMonitor'
import { emailBase, listingExpiredEmail, subscriptionExpiryEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
const FROM = 'NyumbaFasta <noreply@nyumbafasta.co>'

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const r = new Resend(process.env.RESEND_API_KEY)
  await r.emails.send({ from: FROM, to, subject, html })
}

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function verify(req: NextRequest): boolean {
  // Vercel sends Authorization: Bearer <CRON_SECRET>
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — called by Vercel Cron at 3 AM UTC (6 AM Tanzania)
export async function GET(req: NextRequest) {
  if (!verify(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runDailyTasks()
}

// POST — called by admin panel "Run Now" button (via /api/v1/admin/run-cron)
export async function POST(req: NextRequest) {
  if (!verify(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runDailyTasks()
}

async function runDailyTasks() {
  const admin = getAdmin()
  const results: string[] = []
  const errors: string[]  = []
  const now = new Date().toISOString()

  // ── 1. Trial reminders + expire trials ────────────────
  try {
    await admin.rpc('send_trial_reminders')
    results.push('✅ Trial reminders zimetumwa')
  } catch (e) {
    errors.push(`❌ Trial reminders: ${String(e)}`)
  }

  // ── 2. Expire active boosts whose boosted_until has passed ──
  try {
    const { data: expiredBoosts } = await admin
      .from('listings')
      .update({ is_boosted: false, boosted_until: null })
      .lt('boosted_until', now)
      .eq('is_boosted', true)
      .select('id')
    results.push(`✅ Boosts zilizokwisha: ${expiredBoosts?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Expire boosts: ${String(e)}`)
  }

  // ── 3. Expire active listings past expires_at + notify ─
  try {
    const { data: expiredListings } = await admin
      .from('listings')
      .update({ status: 'expired' })
      .lt('expires_at', now)
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .select('id, title, dalali_id')

    if (expiredListings?.length) {
      await admin.from('notifications').insert(
        expiredListings.map(l => ({
          user_id: l.dalali_id,
          type: 'listing_expired',
          title: '❌ Listing Imekwisha',
          body: `Listing yako "${l.title}" imekwisha. Huisha sasa ili iendelee kuonekana kwa wateja.`,
          is_read: false,
          ref_id: l.id,
        }))
      )
    }
    results.push(`✅ Listings zilizokwisha: ${expiredListings?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Expire listings: ${String(e)}`)
  }

  // ── 4. Expire paid subscriptions → grace_period ───────
  try {
    const { data: expiredSubs } = await admin
      .from('subscriptions')
      .update({ status: 'grace_period' })
      .lt('expires_at', now)
      .eq('is_trial', false)
      .eq('status', 'active')
      .select('id, dalali_id')

    if (expiredSubs?.length) {
      const gracePeriodUntil = new Date(Date.now() + 3 * 86_400_000).toISOString()

      // Set grace_period_until
      await admin
        .from('subscriptions')
        .update({ grace_period_until: gracePeriodUntil })
        .in('id', expiredSubs.map(s => s.id))

      // Notify each dalali
      await admin.from('notifications').insert(
        expiredSubs.map(s => ({
          user_id:  s.dalali_id,
          type:     'subscription_expired',
          title:    '⚠️ Subscription Imekwisha',
          body:     'Una siku 3 za grace period. Lipa sasa usipoteze wateja.',
          is_read:  false,
        }))
      )
    }
    results.push(`✅ Subscriptions zilizokwisha: ${expiredSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Expire subscriptions: ${String(e)}`)
  }

  // ── 5. End grace period → downgrade to free plan (show only 2 listings) ──
  try {
    const { data: graceEnded } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .lt('grace_period_until', now)
      .eq('status', 'grace_period')
      .select('id, dalali_id, plan')

    if (graceEnded?.length) {
      let totalSuspended = 0

      for (const sub of graceEnded) {
        // Keep listings active but hide extras — free plan shows 2 listings only.
        // Boosted listings go first (they paid for visibility), then by recency.
        const { data: activeLs } = await admin
          .from('listings')
          .select('id')
          .eq('dalali_id', sub.dalali_id)
          .eq('status', 'active')
          .eq('is_sub_suspended', false)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })

        const toSuspend = (activeLs ?? []).slice(2) // keep first 2 visible
        if (toSuspend.length > 0) {
          await admin.from('listings')
            .update({ is_sub_suspended: true })
            .in('id', toSuspend.map(l => l.id))
          totalSuspended += toSuspend.length
        }
      }

      // Notify each dalali
      await admin.from('notifications').insert(
        graceEnded.map(s => ({
          user_id:  s.dalali_id,
          type:     'account_suspended',
          title:    '🚫 Subscription Imeisha — Free Plan',
          body:     'Subscription yako imeisha. Listing mbili tu zinaonekana kwa wateja. Lipa sasa uzirudishe zote.',
          is_read:  false,
        }))
      )

      // Revoke premium badge for dalali whose last premium sub just fully expired
      const premiumDalaliIds = [...new Set(
        graceEnded
          .filter(s => s.plan === 'premium' || s.plan === 'enterprise')
          .map(s => s.dalali_id)
      )]
      for (const dalaliId of premiumDalaliIds) {
        const { count } = await admin
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('dalali_id', dalaliId)
          .in('plan', ['premium', 'enterprise'])
          .eq('status', 'active')
        if (count === 0) {
          await admin.from('dalali_profiles').update({ is_premium_verified: false }).eq('id', dalaliId)
        }
      }

      results.push(`✅ Grace period ended: ${graceEnded.length} subs, ${totalSuspended} listings zilizosimamishwa`)
    } else {
      results.push('✅ Grace period ended: hakuna')
    }
  } catch (e) {
    errors.push(`❌ Grace period: ${String(e)}`)
  }

  // ── 5b. Extra listings expiry (30 days after purchase) ──────────────────
  try {
    const { data: expiredExtra } = await admin
      .from('subscriptions')
      .update({ extra_listings: 0, extra_listings_expires_at: null })
      .lt('extra_listings_expires_at', now)
      .not('extra_listings_expires_at', 'is', null)
      .eq('status', 'active')
      .gt('extra_listings', 0)
      .select('id, dalali_id, plan')

    if (expiredExtra?.length) {
      // Re-enforce plan base limit — listings that were only allowed because of
      // extra slots must be suspended now that those slots have expired.
      const PLAN_BASE_LIMITS: Record<string, number> = { free: 2, basic: 5, premium: 20, enterprise: 50 }
      let totalReSuspended = 0

      for (const sub of expiredExtra) {
        const baseLimit = PLAN_BASE_LIMITS[sub.plan as string] ?? 2

        const { data: activeLs } = await admin
          .from('listings')
          .select('id')
          .eq('dalali_id', sub.dalali_id)
          .eq('status', 'active')
          .eq('is_sub_suspended', false)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })

        const toSuspend = (activeLs ?? []).slice(baseLimit)
        if (toSuspend.length > 0) {
          await admin.from('listings')
            .update({ is_sub_suspended: true })
            .in('id', toSuspend.map(l => l.id))
          totalReSuspended += toSuspend.length
        }
      }

      await admin.from('notifications').insert(
        expiredExtra.map(s => ({
          user_id:  s.dalali_id,
          type:     'extra_listings_expired',
          title:    '⏰ Extra Listings Zimeisha',
          body:     'Listings za ziada ulizolipa zimekwisha (siku 30). Baadhi ya listings zimesimamishwa. Nunua tena uendelee kupost.',
          is_read:  false,
        }))
      )

      results.push(`✅ Extra listings expired: ${expiredExtra.length} (${totalReSuspended} listings zilizosimamishwa)`)
    } else {
      results.push('✅ Extra listings expiry: hakuna')
    }
  } catch (e) {
    errors.push(`❌ Extra listings expiry: ${String(e)}`)
  }

  // ── 6. Auto-suspend dalali wenye ripoti 3+ ────────────
  try {
    // Get dalali IDs with 3+ pending reports (not yet suspended)
    const { data: reportCounts } = await admin
      .from('reports')
      .select('reported_dalali_id')
      .eq('status', 'pending')

    if (reportCounts?.length) {
      // Count per dalali
      const counts: Record<string, number> = {}
      reportCounts.forEach(r => {
        counts[r.reported_dalali_id] = (counts[r.reported_dalali_id] ?? 0) + 1
      })

      const toSuspend = Object.entries(counts)
        .filter(([, n]) => n >= 3)
        .map(([id]) => id)

      if (toSuspend.length) {
        // Suspend users still active
        const { data: suspended } = await admin
          .from('users')
          .update({ is_active: false })
          .in('id', toSuspend)
          .eq('is_active', true)
          .select('id, full_name')

        if (suspended?.length) {
          // Notify all admins
          const { data: admins } = await admin
            .from('users')
            .select('id')
            .eq('role', 'admin')

          if (admins?.length) {
            await admin.from('notifications').insert(
              admins.map(a => ({
                user_id:  a.id,
                type:     'scam_auto_suspended',
                title:    '🚨 Dalali Amesuspended Auto',
                body:     `${suspended.length} dalali amesuspended kwa ripoti 3+ — angalia Admin Panel`,
                is_read:  false,
              }))
            )
          }
        }
        results.push(`✅ Scam auto-suspend: ${suspended?.length ?? 0} users`)
      } else {
        results.push('✅ Scam check: hakuna users wa suspend')
      }
    } else {
      results.push('✅ Scam check: hakuna ripoti pending')
    }
  } catch (e) {
    errors.push(`❌ Scam check: ${String(e)}`)
  }

  // ── 7. Subscription renewal reminders (3 days before expiry) ──
  try {
    const in3days = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const { data: expiringSoon } = await admin
      .from('subscriptions')
      .select('id, dalali_id, plan, expires_at')
      .eq('status', 'active')
      .eq('is_trial', false)
      .lt('expires_at', in3days)
      .gt('expires_at', now)

    if (expiringSoon?.length) {
      // Only notify those who haven't received a reminder recently
      const { data: recentNotifs } = await admin
        .from('notifications')
        .select('user_id')
        .eq('type', 'subscription_expiring_soon')
        .gt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())

      const alreadyNotified = new Set(recentNotifs?.map(n => n.user_id) ?? [])

      const toNotify = expiringSoon.filter(s => !alreadyNotified.has(s.dalali_id))

      if (toNotify.length) {
        await admin.from('notifications').insert(
          toNotify.map(s => ({
            user_id:  s.dalali_id,
            type:     'subscription_expiring_soon',
            title:    '⏰ Subscription Karibu Kuisha',
            body:     `Plan yako ya ${s.plan === 'premium' ? 'Premium' : 'Basic'} itaisha siku 3. Huisha mapema usipoteze wateja.`,
            is_read:  false,
          }))
        )
      }
      results.push(`✅ Subscription reminders: ${toNotify.length} zimetumwa`)
    } else {
      results.push('✅ Subscription reminders: hakuna zinazoisha hivi karibuni')
    }
  } catch (e) {
    errors.push(`❌ Subscription reminders: ${String(e)}`)
  }

  // ── 8. Listing expiry reminders ───────────────────────
  try {
    const nowDate = new Date()

    // 14-day reminder — once only (guarded by expiry_reminded_at)
    const { data: expiring14 } = await admin
      .from('listings')
      .select('id, title, dalali_id, expires_at')
      .eq('status', 'active')
      .gte('expires_at', new Date(nowDate.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString())
      .lte('expires_at', new Date(nowDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString())
      .is('expiry_reminded_at', null)

    if (expiring14?.length) {
      await admin.from('notifications').insert(
        expiring14.map(listing => ({
          user_id: listing.dalali_id,
          type: 'listing_expiring_14days',
          title: '⏰ Listing Karibu Kuisha',
          body: `Listing yako "${listing.title}" itaisha siku 14. Huisha sasa ili iendelee kuonekana.`,
          is_read: false,
          ref_id: listing.id,
        }))
      )
      await admin
        .from('listings')
        .update({ expiry_reminded_at: nowDate.toISOString() })
        .in('id', expiring14.map(l => l.id))
    }
    results.push(`✅ Expiry reminders 14 days: ${expiring14?.length ?? 0}`)

    // 7-day reminder — once only (guarded by expiry_7day_reminded_at)
    const { data: expiring7 } = await admin
      .from('listings')
      .select('id, title, dalali_id, expires_at')
      .eq('status', 'active')
      .gte('expires_at', new Date(nowDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString())
      .lte('expires_at', new Date(nowDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .is('expiry_7day_reminded_at', null)

    if (expiring7?.length) {
      await admin.from('notifications').insert(
        expiring7.map(listing => ({
          user_id: listing.dalali_id,
          type: 'listing_expiring_7days',
          title: '🚨 Siku 7 tu Zimebaki!',
          body: `Listing yako "${listing.title}" itaisha siku 7. Huisha haraka!`,
          is_read: false,
          ref_id: listing.id,
        }))
      )
      await admin
        .from('listings')
        .update({ expiry_7day_reminded_at: nowDate.toISOString() })
        .in('id', expiring7.map(l => l.id))
    }
    results.push(`✅ Expiry reminders 7 days: ${expiring7?.length ?? 0}`)

    // 1-day reminder
    const { data: expiring1 } = await admin
      .from('listings')
      .select('id, title, dalali_id')
      .eq('status', 'active')
      .gte('expires_at', nowDate.toISOString())
      .lte('expires_at', new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString())

    if (expiring1?.length) {
      await admin.from('notifications').insert(
        expiring1.map(listing => ({
          user_id: listing.dalali_id,
          type: 'listing_expiring_today',
          title: '⚠️ Leo ni Siku ya Mwisho!',
          body: `Listing yako "${listing.title}" itaisha LEO. Huisha sasa hivi!`,
          is_read: false,
          ref_id: listing.id,
        }))
      )
    }
    results.push(`✅ Expiry reminders today: ${expiring1?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Listing expiry reminders: ${String(e)}`)
  }

  // ── 9. Lead Agent — Daily Scraping ────────────────────
  try {
    const dayOfWeek = new Date().getDay()

    let regionsToRun: string[] = PRIORITY_REGIONS

    if (dayOfWeek === 1 || dayOfWeek === 4) {
      regionsToRun = [...PRIORITY_REGIONS, ...SECONDARY_REGIONS]
    }

    if (dayOfWeek === 6) {
      regionsToRun = [
        ...PRIORITY_REGIONS,
        ...SECONDARY_REGIONS,
        ...TERTIARY_REGIONS,
      ]
    }

    for (const region of regionsToRun) {
      await runGoogleMapsRunner(region)
      await new Promise(r => setTimeout(r, 2000))
    }

    results.push(`✅ Lead Agent: mikoa ${regionsToRun.length} imekamilika`)
  } catch (e) {
    errors.push(`❌ Lead Agent: ${String(e)}`)
  }

  // ── 10. Timeout stale pending payments (older than 10 min) ──
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString()
    const { data: timedOutUnlocks } = await admin
      .from('contact_unlocks')
      .update({ status: 'failed' })
      .eq('status', 'pending')
      .lt('created_at', tenMinAgo)
      .select('id')
    const { data: timedOutSubs } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('created_at', tenMinAgo)
      .select('id')
    results.push(`✅ Timed-out unlocks: ${timedOutUnlocks?.length ?? 0}, subs: ${timedOutSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Payment cleanup: ${String(e)}`)
  }

  // ── 11. CRM Auto-followup ──
  try {
    const followupUrl = `${APP_URL}/api/v1/crm/followup`
    const res = await fetch(followupUrl, {
      method: 'POST',
      headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
    })
    const data = await res.json()
    results.push(`✅ CRM Followups: ${(data.results as string[])?.length ?? 0} processed`)
    if (data.errors?.length) errors.push(`❌ Followup errors: ${data.errors.join(', ')}`)
  } catch (e) {
    errors.push(`❌ CRM Followup: ${String(e)}`)
  }

  // ── 12. Email: Listing expired today ─────────────────
  try {
    const { data: expiredToday } = await admin
      .from('listings')
      .select('id, title, dalali_id, users:dalali_id (email, full_name)')
      .eq('status', 'expired')
      .gte('expires_at', new Date(Date.now() - 86_400_000).toISOString())
      .lt('expires_at', now)

    for (const l of expiredToday ?? []) {
      const user = (l.users as unknown as { email: string; full_name: string } | null)
      if (!user?.email) continue
      const tpl = listingExpiredEmail(user.full_name, l.title)
      await sendEmail(user.email, tpl.subject, tpl.html)
    }
    results.push(`✅ Email listing expired: ${expiredToday?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Email listing expired: ${String(e)}`)
  }

  // ── 13a. Email: Subscription expiring in 7 days ──────
  try {
    const in7days  = new Date(Date.now() + 7  * 86_400_000).toISOString()
    const in6days  = new Date(Date.now() + 6  * 86_400_000).toISOString()
    const { data: expiring7Subs } = await admin
      .from('subscriptions')
      .select('plan, expires_at, dalali_id, users:dalali_id (email, full_name)')
      .eq('status', 'active')
      .neq('plan', 'free')
      .gte('expires_at', in6days)
      .lte('expires_at', in7days)

    // Guard: don't re-notify if already notified within 3 days
    const { data: alreadyNotif7 } = await admin
      .from('notifications')
      .select('user_id')
      .eq('type', 'subscription_expiring_7days')
      .gt('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString())

    const notified7Set = new Set((alreadyNotif7 ?? []).map(n => n.user_id))

    for (const s of expiring7Subs ?? []) {
      if (notified7Set.has(s.dalali_id)) continue
      const user = (s.users as unknown as { email: string; full_name: string } | null)
      if (!user?.email) continue
      const planName = String(s.plan).toUpperCase()
      const expiryDate = new Date(s.expires_at as string).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
      const tpl = subscriptionExpiryEmail(user.full_name, planName, expiryDate, 7)
      await sendEmail(user.email, tpl.subject, tpl.html)
      await admin.from('notifications').insert({
        user_id: s.dalali_id, type: 'subscription_expiring_7days',
        title: '⏰ Subscription Inaisha Siku 7',
        body: `Plan yako ya ${planName} inaisha ${expiryDate}. Huisha mapema.`,
        is_read: false,
      })
    }
    results.push(`✅ Email sub expiry 7 days: ${expiring7Subs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Email sub expiry 7 days: ${String(e)}`)
  }

  // ── 13b. Email: Subscription expiring in 3 days ────────
  try {
    const in3days = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const in2days = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const { data: expiringSubs } = await admin
      .from('subscriptions')
      .select('plan, expires_at, dalali_id, users:dalali_id (email, full_name)')
      .eq('status', 'active')
      .neq('plan', 'free')
      .gte('expires_at', in2days)
      .lte('expires_at', in3days)

    const { data: alreadyNotif3 } = await admin
      .from('notifications')
      .select('user_id')
      .eq('type', 'subscription_expiring_soon')
      .gt('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString())

    const notified3Set = new Set((alreadyNotif3 ?? []).map(n => n.user_id))

    for (const s of expiringSubs ?? []) {
      if (notified3Set.has(s.dalali_id)) continue
      const user = (s.users as unknown as { email: string; full_name: string } | null)
      if (!user?.email) continue
      const planName = String(s.plan).toUpperCase()
      const expiryDate = new Date(s.expires_at as string).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
      const tpl = subscriptionExpiryEmail(user.full_name, planName, expiryDate, 3)
      await sendEmail(user.email, tpl.subject, tpl.html)
    }
    results.push(`✅ Email sub expiry 3 days: ${expiringSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Email sub expiry 3 days: ${String(e)}`)
  }

  // ── 14. Email: Comprehensive daily revenue report → ADMIN ─
  try {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()

    // Queries without FK joins — boost_payments and payments tables don't have
    // PostgREST FK relationships to users, so join syntax fails silently.
    // Names are fetched separately below via a single .in() query.
    const [unlocksRes, subsRes, boostsRes, extraListingsRes, adPaysRes] = await Promise.all([
      admin.from('contact_unlocks')
        .select('dalali_id, amount_paid')
        .gte('created_at', yesterday)
        .eq('status', 'completed'),
      // starts_at is set when the subscription is activated by the webhook
      admin.from('subscriptions')
        .select('plan, amount_paid, dalali_id')
        .gte('starts_at', yesterday)
        .in('status', ['active', 'grace_period'])
        .neq('plan', 'free'),
      admin.from('boost_payments')
        .select('amount, weeks, dalali_id')
        .gte('created_at', yesterday)
        .eq('status', 'completed'),
      admin.from('payments')
        .select('amount, dalali_id')
        .eq('type', 'extra_listings')
        .gte('created_at', yesterday)
        .eq('status', 'completed'),
      admin.from('ad_payments')
        .select('id, amount, advertiser_id, campaign_id, provider, paid_at')
        .gte('paid_at', yesterday)
        .eq('status', 'completed'),
    ])

    const unlocks       = unlocksRes.data ?? []
    const subs          = subsRes.data ?? []
    const boosts        = boostsRes.data ?? []
    const extraListings = extraListingsRes.data ?? []
    const adPays        = adPaysRes.data ?? []

    const unlockRevenue = unlocks.reduce((s, r) => s + Number(r.amount_paid ?? 2000), 0)
    const subRevenue    = subs.reduce((s, r) => s + Number(r.amount_paid ?? 0), 0)
    const boostRevenue  = boosts.reduce((s, r) => s + Number(r.amount ?? 0), 0)
    const extraRevenue  = extraListings.reduce((s, r) => s + Number(r.amount ?? 0), 0)
    const adRevenue     = adPays.reduce((s, r) => s + Number(r.amount ?? 0), 0)
    const totalRevenue  = unlockRevenue + subRevenue + boostRevenue + extraRevenue + adRevenue

    // Fetch dalali names in one query (avoids FK join failures)
    const allDalaliIds = [...new Set([
      ...unlocks.map(u => u.dalali_id),
      ...subs.map(s => s.dalali_id),
      ...boosts.map(b => b.dalali_id),
      ...extraListings.map(e => e.dalali_id),
    ].filter(Boolean))]

    const dalaliNames: Record<string, string> = {}
    if (allDalaliIds.length > 0) {
      const { data: ud } = await admin.from('users').select('id, full_name').in('id', allDalaliIds)
      for (const u of ud ?? []) dalaliNames[u.id] = u.full_name ?? '—'
    }

    // Fetch advertiser names for ad payments
    const allAdvertiserIds = [...new Set(adPays.map(a => a.advertiser_id).filter(Boolean))]
    const advertiserNames: Record<string, string> = {}
    if (allAdvertiserIds.length > 0) {
      const { data: advs } = await admin.from('advertisers').select('id, business_name').in('id', allAdvertiserIds)
      for (const a of advs ?? []) advertiserNames[a.id] = a.business_name ?? '—'
    }

    // Fetch campaign ad_type for each ad payment
    const allCampaignIds = [...new Set(adPays.map(a => a.campaign_id).filter(Boolean))]
    const campaignTypes: Record<string, string> = {}
    if (allCampaignIds.length > 0) {
      const { data: camps } = await admin.from('ad_campaigns').select('id, ad_type').in('id', allCampaignIds)
      for (const c of camps ?? []) campaignTypes[c.id] = c.ad_type ?? '—'
    }

    function tableRow(...cells: string[]) {
      return `<tr>${cells.map((c, i) => `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;${i > 0 ? 'text-align:right' : ''}">${c}</td>`).join('')}</tr>`
    }

    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co'
    const todayLabel = new Date().toLocaleDateString('sw-TZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    await sendEmail(
      adminEmail,
      `📊 Ripoti ya Mapato — Leo — Tsh ${totalRevenue.toLocaleString()}`,
      emailBase(`
        <span style="font-size:22px;font-weight:700;color:#111827;margin:0 0 4px;display:block">📊 Ripoti ya Mapato</span>
        <span style="font-size:14px;color:#6b7280;display:block;margin:0 0 24px">${todayLabel}</span>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px">
          <tr>
            <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;text-align:center">
              <div style="font-size:28px;font-weight:700;color:#166534">Tsh ${totalRevenue.toLocaleString()}</div>
              <div style="font-size:13px;color:#4b5563;margin-top:4px">Jumla ya Mapato Leo</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:20px 0">
          <tr style="background:#1D9E75;color:white">
            <td style="padding:10px 14px;font-size:13px;font-weight:600">Chanzo cha Mapato</td>
            <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600">Idadi</td>
            <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600">Mapato</td>
          </tr>
          ${tableRow('🔓 Contact Unlocks', `${unlocks.length}`, `Tsh ${unlockRevenue.toLocaleString()}`)}
          ${tableRow('📋 Subscriptions Mpya', `${subs.length}`, `Tsh ${subRevenue.toLocaleString()}`)}
          ${tableRow('⚡ Boost Payments', `${boosts.length}`, `Tsh ${boostRevenue.toLocaleString()}`)}
          ${tableRow('➕ Extra Listings', `${extraListings.length}`, `Tsh ${extraRevenue.toLocaleString()}`)}
          ${tableRow('📢 Matangazo (Ads)', `${adPays.length}`, `Tsh ${adRevenue.toLocaleString()}`)}
          <tr style="background:#f9fafb;font-weight:700">
            <td style="padding:10px 14px;border-top:2px solid #1D9E75;font-size:13px">JUMLA</td>
            <td style="padding:10px 14px;text-align:right;border-top:2px solid #1D9E75;font-size:13px">${unlocks.length + subs.length + boosts.length + extraListings.length + adPays.length}</td>
            <td style="padding:10px 14px;text-align:right;border-top:2px solid #1D9E75;color:#1D9E75;font-size:13px">Tsh ${totalRevenue.toLocaleString()}</td>
          </tr>
        </table>

        ${subs.length > 0 ? `
        <p style="font-size:15px;font-weight:700;color:#374151;margin:20px 0 8px">📋 Subscriptions Zilizolipwa Leo</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 14px;font-size:12px;font-weight:600">Dalali</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Plan</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Kiasi</td>
          </tr>
          ${subs.map(s => tableRow(
            dalaliNames[s.dalali_id] ?? '—',
            String(s.plan).toUpperCase(),
            `Tsh ${Number(s.amount_paid ?? 0).toLocaleString()}`
          )).join('')}
        </table>` : ''}

        ${boosts.length > 0 ? `
        <p style="font-size:15px;font-weight:700;color:#374151;margin:20px 0 8px">⚡ Boost Payments Leo</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 14px;font-size:12px;font-weight:600">Dalali</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Wiki</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Kiasi</td>
          </tr>
          ${boosts.map(b => tableRow(
            dalaliNames[b.dalali_id] ?? '—',
            `${b.weeks ?? 1}`,
            `Tsh ${Number(b.amount ?? 0).toLocaleString()}`
          )).join('')}
        </table>` : ''}

        ${extraListings.length > 0 ? `
        <p style="font-size:15px;font-weight:700;color:#374151;margin:20px 0 8px">➕ Extra Listings Zilizolipwa Leo</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 14px;font-size:12px;font-weight:600">Dalali</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Kiasi</td>
          </tr>
          ${extraListings.map(e => tableRow(
            dalaliNames[e.dalali_id] ?? '—',
            `Tsh ${Number(e.amount ?? 0).toLocaleString()}`
          )).join('')}
        </table>` : ''}

        ${adPays.length > 0 ? `
        <p style="font-size:15px;font-weight:700;color:#374151;margin:20px 0 8px">📢 Matangazo Yaliyolipwa Leo</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 14px;font-size:12px;font-weight:600">Advertiser</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Aina</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Njia</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Kiasi</td>
          </tr>
          ${adPays.map(a => {
            const cells = [
              advertiserNames[a.advertiser_id] ?? '—',
              (campaignTypes[a.campaign_id] ?? '—').toUpperCase(),
              (a.provider ?? 'N/A').toUpperCase(),
              `Tsh ${Number(a.amount ?? 0).toLocaleString()}`,
            ]
            return `<tr>${cells.map((c, i) => `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;${i > 0 ? 'text-align:right' : ''}">${c}</td>`).join('')}</tr>`
          }).join('')}
          <tr style="background:#fefce8;font-weight:700">
            <td style="padding:8px 14px;font-size:12px" colspan="3">JUMLA</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;color:#1D9E75">Tsh ${adRevenue.toLocaleString()}</td>
          </tr>
        </table>` : ''}

        ${unlocks.length > 0 ? `
        <p style="font-size:15px;font-weight:700;color:#374151;margin:20px 0 8px">🔓 Unlocks kwa Dalali</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 14px;font-size:12px;font-weight:600">Dalali</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Unlocks</td>
            <td style="padding:8px 14px;text-align:right;font-size:12px;font-weight:600">Mapato</td>
          </tr>
          ${(() => {
            const byD: Record<string, { n: number; amt: number }> = {}
            for (const u of unlocks) {
              if (!byD[u.dalali_id]) byD[u.dalali_id] = { n: 0, amt: 0 }
              byD[u.dalali_id].n++
              byD[u.dalali_id].amt += Number(u.amount_paid ?? 2000)
            }
            return Object.entries(byD).sort((a, b) => b[1].n - a[1].n)
              .map(([id, { n, amt }]) => tableRow(dalaliNames[id] ?? '—', `${n}`, `Tsh ${amt.toLocaleString()}`)).join('')
          })()}
        </table>` : ''}

        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="center">
            <a href="${APP_URL}/admin" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;margin-top:8px">Fungua Admin Panel →</a>
          </td></tr>
        </table>
      `, `Ripoti ya mapato — Tsh ${totalRevenue.toLocaleString()}`),
    )
    results.push(`✅ Admin daily revenue email: Tsh ${totalRevenue.toLocaleString()} (unlocks:${unlocks.length} subs:${subs.length} boosts:${boosts.length} extra:${extraListings.length} ads:${adPays.length})`)
  } catch (e) {
    errors.push(`❌ Admin revenue email: ${String(e)}`)
  }

  // ── 15. Dalali account monitoring — warnings + 90-day deletion ──
  try {
    const { warningsSent, accountsDeleted, errors: monitorErrors } =
      await monitorDalaliAccounts()
    results.push(
      `✅ Dalali monitor: ${warningsSent} maonyo, ${accountsDeleted} akaunti zilizofutwa`,
    )
    if (monitorErrors.length) errors.push(`❌ Dalali monitor: ${monitorErrors.join('; ')}`)
  } catch (e) {
    errors.push(`❌ Dalali monitor: ${String(e)}`)
  }

  // ── 16. Rental reminders — WhatsApp to dalali 24h after client unlock ──
  try {
    const { sendRentalReminders } = await import('@/lib/listings/rentalReminder')
    const { checked, reminded, errors: reminderErrors } = await sendRentalReminders()
    results.push(`✅ Rental reminders: ${reminded}/${checked} zimetumwa`)
    if (reminderErrors.length) errors.push(`❌ Rental reminders: ${reminderErrors.join('; ')}`)
  } catch (e) {
    errors.push(`❌ Rental reminders: ${String(e)}`)
  }

  // ── 17. Social: process scheduled posts ──────────────
  try {
    const { processDueScheduledPosts } = await import('@/lib/social/autoPost')
    await processDueScheduledPosts()
    results.push('✅ Scheduled social posts zimeshughulikiwa')
  } catch (e) {
    errors.push(`❌ Scheduled posts: ${String(e)}`)
  }

  // ── 18. Social: refresh IG/FB post metrics ────────────
  try {
    const { updateAllPostMetrics } = await import('@/lib/social/metricsTracker')
    const { updated, failed } = await updateAllPostMetrics()
    results.push(`✅ Social metrics: ${updated} updated, ${failed} failed`)
  } catch (e) {
    errors.push(`❌ Social metrics: ${String(e)}`)
  }

  // ── 19. Social: sync new listings to Facebook Marketplace ──
  try {
    const { syncAllListingsToMarketplace, renewExpiringListings } = await import('@/lib/social/facebookMarketplace')
    const sync = await syncAllListingsToMarketplace()
    await renewExpiringListings()
    results.push(`✅ Marketplace sync: ${sync.posted} posted, ${sync.failed} failed, ${sync.skipped} skipped`)
  } catch (e) {
    errors.push(`❌ Marketplace sync: ${String(e)}`)
  }

  // ── 20. Social: poll TikTok 'processing' posts for final status ──
  try {
    const { getValidToken, checkTikTokPostStatus } = await import('@/lib/social/tiktok')
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: processingPosts } = await admin
      .from('tiktok_posts')
      .select('id, publish_id')
      .eq('status', 'processing')
      .gte('created_at', cutoff)
      .not('publish_id', 'is', null)
      .limit(20)

    if (processingPosts?.length) {
      const token = await getValidToken()
      if (token) {
        let ttUpdated = 0
        for (const post of processingPosts) {
          try {
            const st = await checkTikTokPostStatus(post.publish_id as string, token)
            if (st.status === 'PUBLISH_COMPLETE') {
              await admin.from('tiktok_posts').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', post.id)
              ttUpdated++
            } else if (st.status === 'FAILED' || st.status === 'CANCELLED') {
              await admin.from('tiktok_posts').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', post.id)
              ttUpdated++
            }
          } catch { /* skip this post */ }
        }
        results.push(`✅ TikTok status poll: ${ttUpdated}/${processingPosts.length} updated`)
      } else {
        results.push('⚠️ TikTok status poll: token haipatikani')
      }
    } else {
      results.push('✅ TikTok status poll: hakuna posts za processing')
    }
  } catch (e) {
    errors.push(`❌ TikTok status poll: ${String(e)}`)
  }

  // ── 21. Ad campaigns: expire and renewal reminders ──
  try {
    const nowIso = new Date().toISOString()

    // Mark expired campaigns
    const { data: expiredAds } = await admin
      .from('ad_campaigns')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('status', 'active')
      .lt('expires_at', nowIso)
      .select('id, ad_type, advertiser_id')

    if (expiredAds?.length) {
      results.push(`✅ Ad campaigns: ${expiredAds.length} zimeisha`)
    }

    // 3-day renewal reminders
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: expiringSoon } = await admin
      .from('ad_campaigns')
      .select('id, ad_type, advertiser:advertiser_id (business_name, whatsapp_number)')
      .eq('status', 'active')
      .lt('expires_at', in3Days)
      .gt('expires_at', nowIso)

    if (expiringSoon?.length) {
      const { notifyAdvertiserRenewalReminder } = await import('@/lib/ads/adNotifications')
      for (const c of expiringSoon) {
        const adv = c.advertiser as unknown as { business_name: string; whatsapp_number: string | null }
        if (adv?.whatsapp_number) {
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + 3)
          const daysLeft = 3
          await notifyAdvertiserRenewalReminder(
            adv.whatsapp_number, adv.business_name, c.ad_type, daysLeft
          ).catch(() => {})
        }
      }
      results.push(`✅ Ad renewal reminders: ${expiringSoon.length} zimetumwa`)
    }

    // Notify waiting list when slots opened up from expirations
    if (expiredAds?.length) {
      const { notifyWaitingListSlotOpen } = await import('@/lib/ads/adNotifications')
      const freedSlots = new Set(expiredAds.map(a => `${a.ad_type}`))
      for (const adType of freedSlots) {
        const { data: waiting } = await admin
          .from('ad_waiting_list')
          .select('id, advertiser:advertiser_id (business_name, whatsapp_number), region')
          .eq('ad_type', adType)
          .eq('status', 'waiting')
          .order('created_at', { ascending: true })
          .limit(3)

        for (const w of waiting ?? []) {
          const adv = w.advertiser as unknown as { business_name: string; whatsapp_number: string | null }
          if (adv?.whatsapp_number) {
            await notifyWaitingListSlotOpen(adv.whatsapp_number, adv.business_name, adType, w.region).catch(() => {})
          }
        }
      }
    }
  } catch (e) {
    errors.push(`❌ Ad expiry/reminders: ${String(e)}`)
  }

  // ── 22. Purge stale ad impressions (older than 24h) ──
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('ad_impressions')
      .delete({ count: 'exact' })
      .lt('shown_at', cutoff)
    results.push(`✅ Ad impressions zilizofutwa: ${count ?? 0}`)
  } catch (e) {
    errors.push(`❌ Ad impressions purge: ${String(e)}`)
  }

  return Response.json({
    success: errors.length === 0,
    timestamp: now,
    results,
    errors,
  })
}

