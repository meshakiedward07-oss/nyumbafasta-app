import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  runGoogleMapsRunner,
  runGoogleBusinessRunner,
  runFacebookGroupsRunner,
  runFacebookPagesRunner,
  runInstagramRunner,
  runTiktokRunner,
} from '@/lib/agent/runners'
import {
  PRIORITY_REGIONS,
  SECONDARY_REGIONS,
  TERTIARY_REGIONS,
} from '@/lib/agent/regions'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
const FROM = 'NyumbaFasta <noreply@nyumbafasta.co>'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return
  const r = new Resend(process.env.RESEND_API_KEY)
  await r.emails.send({ from: FROM, to, subject, html })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  // ── Lead scraping (existing) ──────────────────────────
  const dayOfWeek = now.getDay()
  const weeklyRegions = dayOfWeek === 1 ? PRIORITY_REGIONS
    : dayOfWeek === 2 ? SECONDARY_REGIONS
    : TERTIARY_REGIONS

  for (const region of weeklyRegions) {
    try {
      const settled = await Promise.allSettled([
        runGoogleMapsRunner(region),
        runGoogleBusinessRunner(region),
        runFacebookGroupsRunner(region),
        runFacebookPagesRunner(region),
        runInstagramRunner(region),
        runTiktokRunner(region),
      ])
      const failed = settled.filter(r => r.status === 'rejected').length
      results.push(`✅ ${region} — ${settled.length - failed}/${settled.length} sources`)
      await new Promise(r => setTimeout(r, 3000))
    } catch (e) {
      errors.push(`❌ ${region}: ${String(e)}`)
    }
  }

  // ── Weekly report email kwa admin ─────────────────────
  try {
    const admin = getAdmin()
    const [
      { count: newLeads },
      { count: newDalali },
      { count: newListings },
      { count: unlocks },
      { count: closedDeals },
    ] = await Promise.all([
      admin.from('agent_leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali').gte('created_at', weekAgo.toISOString()),
      admin.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('contact_unlocks').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('pipeline_stage', 'closed').gte('updated_at', weekAgo.toISOString()),
    ])

    const revenue = (unlocks ?? 0) * 2000
    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co'

    await sendEmail(
      adminEmail,
      `📊 Weekly Report NyumbaFasta — ${now.toLocaleDateString('sw-TZ')}`,
      `<h1 style="color:#1D9E75">📊 Weekly Report NyumbaFasta</h1>
       <p style="color:#64748b">${weekAgo.toLocaleDateString('sw-TZ')} — ${now.toLocaleDateString('sw-TZ')}</p>
       <table style="width:100%;border-collapse:collapse;margin-top:16px">
         <tr style="background:#1D9E75;color:white">
           <td style="padding:12px;font-weight:bold">Kipengele</td>
           <td style="padding:12px;font-weight:bold">Wiki Hii</td>
         </tr>
         <tr style="background:#f9fafb"><td style="padding:12px">🤖 Leads Mpya</td><td style="padding:12px"><strong>${newLeads ?? 0}</strong></td></tr>
         <tr><td style="padding:12px">👨‍💼 Madalali Wapya</td><td style="padding:12px"><strong>${newDalali ?? 0}</strong></td></tr>
         <tr style="background:#f9fafb"><td style="padding:12px">🏠 Listings Mpya</td><td style="padding:12px"><strong>${newListings ?? 0}</strong></td></tr>
         <tr><td style="padding:12px">🔓 Contact Unlocks</td><td style="padding:12px"><strong>${unlocks ?? 0}</strong></td></tr>
         <tr style="background:#f9fafb"><td style="padding:12px">✅ Deals Closed</td><td style="padding:12px"><strong>${closedDeals ?? 0}</strong></td></tr>
         <tr style="background:#1D9E75;color:white"><td style="padding:12px"><strong>💰 Revenue</strong></td><td style="padding:12px"><strong>Tsh ${revenue.toLocaleString()}</strong></td></tr>
       </table>
       <br>
       <a href="${APP_URL}/admin" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Fungua Admin Panel →</a>`,
    )
    results.push('✅ Weekly report email imetumwa')
  } catch (e) {
    errors.push(`❌ Weekly report: ${String(e)}`)
  }

  // ── Dalali hawajafuatilia leads (wiki nzima) ──────────
  try {
    const admin = getAdmin()
    const { data: inactiveLeads } = await admin
      .from('agent_leads')
      .select('assigned_to, users:assigned_to (email, full_name)')
      .not('assigned_to', 'is', null)
      .eq('pipeline_stage', 'new')
      .lt('assigned_at', weekAgo.toISOString())

    const uniqueDalali = new Map<string, { email: string; full_name: string }>()
    for (const lead of inactiveLeads ?? []) {
      const user = lead.users as unknown as { email: string; full_name: string } | null
      if (user?.email && !uniqueDalali.has(lead.assigned_to)) {
        uniqueDalali.set(lead.assigned_to, user)
      }
    }

    for (const dalali of uniqueDalali.values()) {
      await sendEmail(
        dalali.email,
        '💪 Una Leads Zinaokusubiri!',
        `<h2>Habari ${dalali.full_name}!</h2>
         <p>Una leads ambazo bado haujafuatilia wiki nzima.</p>
         <p>Wasiliana nao leo — wateja wanakusubiri! 🏠</p>
         <a href="${APP_URL}/dashboard/crm" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Angalia Leads →</a>`,
      )
    }
    results.push(`✅ Dalali inactive alerts: ${uniqueDalali.size}`)
  } catch (e) {
    errors.push(`❌ Dalali alerts: ${String(e)}`)
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    regions_count: weeklyRegions.length,
    results,
    errors,
  })
}
