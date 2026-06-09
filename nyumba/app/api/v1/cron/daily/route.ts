import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { Resend } from 'resend'
import { runGoogleMapsRunner } from '@/lib/agent/runners'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS,
} from '@/lib/agent/regions'

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
      .update({ is_boosted: false, boost_expires_at: null })
      .lt('boost_expires_at', now)
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
          data: { listing_id: l.id },
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
          data:     { grace_period_until: gracePeriodUntil },
        }))
      )
    }
    results.push(`✅ Subscriptions zilizokwisha: ${expiredSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Expire subscriptions: ${String(e)}`)
  }

  // ── 5. End grace period → suspend listings ────────────
  try {
    const { data: graceEnded } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .lt('grace_period_until', now)
      .eq('status', 'grace_period')
      .select('id, dalali_id')

    if (graceEnded?.length) {
      const dalaliIds = graceEnded.map(s => s.dalali_id)

      // Suspend their active listings
      await admin
        .from('listings')
        .update({ status: 'expired' })
        .in('dalali_id', dalaliIds)
        .eq('status', 'active')

      // Notify each dalali
      await admin.from('notifications').insert(
        graceEnded.map(s => ({
          user_id:  s.dalali_id,
          type:     'account_suspended',
          title:    '🚫 Listings Zimesimamishwa',
          body:     'Listings zako hazionekani kwa wateja. Lipa sasa uzirudishe.',
          is_read:  false,
          data:     {},
        }))
      )
    }
    results.push(`✅ Grace period ended: ${graceEnded?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Grace period: ${String(e)}`)
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
                data:     { suspended_ids: suspended.map(u => u.id) },
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
            data:     { expires_at: s.expires_at, plan: s.plan },
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

    for (const listing of expiring14 || []) {
      await admin.from('notifications').insert({
        user_id: listing.dalali_id,
        type: 'listing_expiring_14days',
        title: '⏰ Listing Karibu Kuisha',
        body: `Listing yako "${listing.title}" itaisha siku 14. Huisha sasa ili iendelee kuonekana.`,
        is_read: false,
        ref_id: listing.id,
        data: { listing_id: listing.id },
      })
      await admin
        .from('listings')
        .update({ expiry_reminded_at: nowDate.toISOString() })
        .eq('id', listing.id)
    }
    results.push(`✅ Expiry reminders 14 days: ${expiring14?.length ?? 0}`)

    // 7-day reminder
    const { data: expiring7 } = await admin
      .from('listings')
      .select('id, title, dalali_id, expires_at')
      .eq('status', 'active')
      .gte('expires_at', new Date(nowDate.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString())
      .lte('expires_at', new Date(nowDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())

    for (const listing of expiring7 || []) {
      await admin.from('notifications').insert({
        user_id: listing.dalali_id,
        type: 'listing_expiring_7days',
        title: '🚨 Siku 7 tu Zimebaki!',
        body: `Listing yako "${listing.title}" itaisha siku 7. Huisha haraka!`,
        is_read: false,
        ref_id: listing.id,
        data: { listing_id: listing.id },
      })
    }
    results.push(`✅ Expiry reminders 7 days: ${expiring7?.length ?? 0}`)

    // 1-day reminder
    const { data: expiring1 } = await admin
      .from('listings')
      .select('id, title, dalali_id')
      .eq('status', 'active')
      .gte('expires_at', nowDate.toISOString())
      .lte('expires_at', new Date(nowDate.getTime() + 24 * 60 * 60 * 1000).toISOString())

    for (const listing of expiring1 || []) {
      await admin.from('notifications').insert({
        user_id: listing.dalali_id,
        type: 'listing_expiring_today',
        title: '🔴 Leo ni Siku ya Mwisho!',
        body: `Listing yako "${listing.title}" itaisha LEO. Huisha sasa hivi!`,
        is_read: false,
        ref_id: listing.id,
        data: { listing_id: listing.id },
      })
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
      await sendEmail(
        user.email,
        '⏰ Listing Yako Imeisha — Renew Sasa',
        `<h2>Habari ${user.full_name}!</h2>
         <p>Listing yako <strong>${l.title}</strong> imeisha leo.</p>
         <p>Renew sasa ili wateja waendelee kukuona:</p>
         <a href="${APP_URL}/dashboard/listings"
           style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
           Renew Listing →
         </a>`,
      )
    }
    results.push(`✅ Email listing expired: ${expiredToday?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Email listing expired: ${String(e)}`)
  }

  // ── 13. Email: Subscription expiring in 3 days ────────
  try {
    const in3days = new Date(Date.now() + 3 * 86_400_000).toISOString()
    const { data: expiringSubs } = await admin
      .from('subscriptions')
      .select('plan, expires_at, users:dalali_id (email, full_name)')
      .eq('status', 'active')
      .neq('plan', 'free')
      .gte('expires_at', now)
      .lte('expires_at', in3days)

    for (const s of expiringSubs ?? []) {
      const user = (s.users as unknown as { email: string; full_name: string } | null)
      if (!user?.email) continue
      await sendEmail(
        user.email,
        `⚠️ Subscription Yako Inaisha Siku 3 — ${String(s.plan).toUpperCase()}`,
        `<h2>Habari ${user.full_name}!</h2>
         <p>Subscription yako ya <strong>${String(s.plan).toUpperCase()}</strong> inaisha tarehe
         <strong>${new Date(s.expires_at as string).toLocaleDateString('sw-TZ')}</strong>.</p>
         <a href="${APP_URL}/dashboard/subscription"
           style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
           Renew Subscription →
         </a>`,
      )
    }
    results.push(`✅ Email subscription expiry: ${expiringSubs?.length ?? 0}`)
  } catch (e) {
    errors.push(`❌ Email subscription expiry: ${String(e)}`)
  }

  // ── 14. Email: Contact unlock daily summary → ADMIN ONLY ─
  try {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    const { data: unlocks } = await admin
      .from('contact_unlocks')
      .select('dalali_id, users:dalali_id (full_name)')
      .gte('created_at', yesterday)
      .eq('status', 'completed')

    const total = unlocks?.length ?? 0
    const revenue = total * 2000

    // Group per dalali for admin table
    const byDalali: Record<string, { name: string; count: number }> = {}
    for (const u of unlocks ?? []) {
      const name = (u.users as unknown as { full_name: string } | null)?.full_name ?? 'Unknown'
      if (!byDalali[u.dalali_id]) byDalali[u.dalali_id] = { name, count: 0 }
      byDalali[u.dalali_id].count++
    }

    const rows = Object.values(byDalali)
      .sort((a, b) => b.count - a.count)
      .map(({ name, count }) =>
        `<tr><td style="padding:10px">${name}</td><td style="padding:10px;text-align:center"><strong>${count}</strong></td><td style="padding:10px;text-align:right">Tsh ${(count * 2000).toLocaleString()}</td></tr>`,
      ).join('')

    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co'
    await sendEmail(
      adminEmail,
      `🔓 Unlocks ya Leo — ${total} contacts, Tsh ${revenue.toLocaleString()}`,
      `<h2>🔓 Contact Unlocks — Leo</h2>
       <p><strong>Jumla ya unlocks:</strong> ${total}</p>
       <p><strong>Mapato ya leo:</strong> Tsh ${revenue.toLocaleString()}</p>
       <table style="width:100%;border-collapse:collapse;margin-top:12px">
         <tr style="background:#1D9E75;color:white">
           <td style="padding:10px">Dalali</td>
           <td style="padding:10px;text-align:center">Unlocks</td>
           <td style="padding:10px;text-align:right">Mapato</td>
         </tr>
         ${rows || '<tr><td colspan="3" style="padding:10px;text-align:center">Hakuna unlocks leo</td></tr>'}
       </table>
       <br>
       <a href="${APP_URL}/admin" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Fungua Admin Panel →</a>`,
    )
    results.push(`✅ Email unlock summary (admin): ${total} unlocks, Tsh ${revenue.toLocaleString()}`)
  } catch (e) {
    errors.push(`❌ Email unlock notify: ${String(e)}`)
  }

  return Response.json({
    success: errors.length === 0,
    timestamp: now,
    results,
    errors,
  })
}

