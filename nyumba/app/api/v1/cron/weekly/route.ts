import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { checkStaleListings } from '@/lib/listings/staleListingCheck'

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
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Cron Weekly] RESEND_API_KEY not set — email skipped to', to)
    return
  }
  const r = new Resend(process.env.RESEND_API_KEY)
  const { error } = await r.emails.send({ from: FROM, to, subject, html })
  if (error) console.error('[Cron Weekly] Resend error:', error)
}

function verifyAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []
  const errors: string[] = []
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  // ── Weekly report email kwa admin ─────────────────────
  try {
    const admin = getAdmin()
    const { getIncomeSummary, formatSourceName } = await import('@/lib/accounting/incomeTracker').then(
      async m => ({ getIncomeSummary: m.getIncomeSummary, formatSourceName: (await import('@/lib/accounting/reportGenerator')).formatSourceName })
    )

    const [
      { count: newLeads },
      { count: newDalali },
      { count: newListings },
      { count: unlocks },
      { count: closedDeals },
      { count: newAdvertisers },
      { count: newCampaigns },
      income,
    ] = await Promise.all([
      admin.from('agent_leads').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali').gte('created_at', weekAgo.toISOString()),
      admin.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('contact_unlocks').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('agent_leads').select('id', { count: 'exact', head: true }).eq('pipeline_stage', 'closed').gte('updated_at', weekAgo.toISOString()),
      admin.from('advertisers').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      admin.from('ad_campaigns').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      getIncomeSummary({ period: 'weekly', date: now }),
    ])

    const fmtTZS = (n: number) => `Tsh ${n.toLocaleString('en-TZ', { minimumFractionDigits: 0 })}`

    // Income breakdown rows — one row per source that had income this week
    const sourceRows = Object.entries(income.bySource)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([source, amt]) => {
        const pct = income.total > 0 ? (((amt as number) / income.total) * 100).toFixed(1) : '0.0'
        return `<tr style="background:#f9fafb">
          <td style="padding:10px 12px">↳ ${formatSourceName(source)}</td>
          <td style="padding:10px 12px;text-align:right">${fmtTZS(amt as number)} <span style="color:#9ca3af;font-size:11px">(${pct}%)</span></td>
        </tr>`
      }).join('')

    const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@nyumbafasta.co'

    await sendEmail(
      adminEmail,
      `📊 Weekly Report NyumbaFasta — ${now.toLocaleDateString('sw-TZ')}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
       <h1 style="color:#1D9E75;margin-bottom:4px">📊 Weekly Report NyumbaFasta</h1>
       <p style="color:#64748b;margin-top:0">${weekAgo.toLocaleDateString('sw-TZ')} — ${now.toLocaleDateString('sw-TZ')}</p>

       <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
         <tr style="background:#1D9E75;color:white">
           <td style="padding:12px;font-weight:bold">Kipengele</td>
           <td style="padding:12px;font-weight:bold;text-align:right">Wiki Hii</td>
         </tr>
         <tr style="background:#f9fafb"><td style="padding:10px 12px">🤖 Leads Mpya</td><td style="padding:10px 12px;text-align:right"><strong>${newLeads ?? 0}</strong></td></tr>
         <tr><td style="padding:10px 12px">👨‍💼 Madalali Wapya</td><td style="padding:10px 12px;text-align:right"><strong>${newDalali ?? 0}</strong></td></tr>
         <tr style="background:#f9fafb"><td style="padding:10px 12px">🏠 Listings Mpya</td><td style="padding:10px 12px;text-align:right"><strong>${newListings ?? 0}</strong></td></tr>
         <tr><td style="padding:10px 12px">🔓 Contact Unlocks</td><td style="padding:10px 12px;text-align:right"><strong>${unlocks ?? 0}</strong></td></tr>
         <tr style="background:#f9fafb"><td style="padding:10px 12px">✅ Deals Closed</td><td style="padding:10px 12px;text-align:right"><strong>${closedDeals ?? 0}</strong></td></tr>
         <tr><td style="padding:10px 12px">🏪 Wafanyabiashara Wapya</td><td style="padding:10px 12px;text-align:right"><strong>${newAdvertisers ?? 0}</strong></td></tr>
         <tr style="background:#f9fafb"><td style="padding:10px 12px">📢 Kampeni Mpya</td><td style="padding:10px 12px;text-align:right"><strong>${newCampaigns ?? 0}</strong></td></tr>
       </table>

       <h2 style="color:#1D9E75;margin-top:24px;margin-bottom:8px">💰 Mapato ya Wiki — ${fmtTZS(income.total)}</h2>
       <table style="width:100%;border-collapse:collapse;font-size:14px">
         <tr style="background:#1D9E75;color:white">
           <td style="padding:10px 12px;font-weight:bold">Chanzo cha Mapato</td>
           <td style="padding:10px 12px;font-weight:bold;text-align:right">Kiasi</td>
         </tr>
         ${sourceRows || '<tr><td colspan="2" style="padding:12px;text-align:center;color:#9ca3af">Hakuna mapato wiki hii</td></tr>'}
         <tr style="background:#dcfce7">
           <td style="padding:10px 12px;font-weight:bold">JUMLA (kabla ya ada)</td>
           <td style="padding:10px 12px;font-weight:bold;text-align:right">${fmtTZS(income.total)}</td>
         </tr>
         <tr>
           <td style="padding:6px 12px;color:#6b7280;font-size:12px">Ada ya AzamPay (1%)</td>
           <td style="padding:6px 12px;color:#6b7280;font-size:12px;text-align:right">-${fmtTZS(income.platformFees)}</td>
         </tr>
         <tr style="background:#f0fdf4">
           <td style="padding:10px 12px;font-weight:bold">Mapato Halisi</td>
           <td style="padding:10px 12px;font-weight:bold;color:#16a34a;text-align:right">${fmtTZS(income.netIncome)}</td>
         </tr>
       </table>
       <p style="color:#9ca3af;font-size:12px">Miamala yote: ${income.transactionCount}</p>

       <br>
       <a href="${APP_URL}/admin" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Fungua Admin Panel →</a>
       <a href="${APP_URL}/admin/accounting" style="background:#f3f4f6;color:#374151;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-left:8px">Hesabu Kamili →</a>
       </div>`,
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
      .select('assigned_to, users:assigned_to (full_name)')
      .not('assigned_to', 'is', null)
      .eq('pipeline_stage', 'new')
      .lt('assigned_at', weekAgo.toISOString())

    // Collect unique dalali IDs and their names
    const uniqueDalali = new Map<string, string>()  // id → full_name
    for (const lead of inactiveLeads ?? []) {
      if (!lead.assigned_to || uniqueDalali.has(lead.assigned_to)) continue
      const user = lead.users as unknown as { full_name: string } | null
      uniqueDalali.set(lead.assigned_to, user?.full_name ?? 'Dalali')
    }

    // Batch-fetch emails from auth.admin (public.users.email is not populated)
    const dalaliIds = [...uniqueDalali.keys()]
    const emailResults = await Promise.allSettled(
      dalaliIds.map(id => admin.auth.admin.getUserById(id))
    )
    for (let i = 0; i < dalaliIds.length; i++) {
      const r = emailResults[i]
      const emailAddr = r.status === 'fulfilled' ? r.value.data?.user?.email : null
      if (!emailAddr) continue
      const fullName = uniqueDalali.get(dalaliIds[i]) ?? 'Dalali'
      await sendEmail(
        emailAddr,
        '📈 Una Leads Zinaokusubiri!',
        `<h2>Habari ${fullName}!</h2>
         <p>Una leads ambazo bado haujafuatilia wiki nzima.</p>
         <p>Wasiliana nao leo — wateja wanakusubiri! 🏠</p>
         <a href="${APP_URL}/dashboard/crm" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">Angalia Leads →</a>`,
      )
    }
    results.push(`✅ Dalali inactive alerts: ${uniqueDalali.size}`)
  } catch (e) {
    errors.push(`❌ Dalali alerts: ${String(e)}`)
  }

  // ── Stale occupancy reminders ─────────────────────────
  try {
    const { checked } = await checkStaleListings()
    results.push(`✅ Stale listing reminders: ${checked}`)
  } catch (e) {
    errors.push(`❌ Stale listings: ${String(e)}`)
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    results,
    errors,
  })
}

// Allow POST so admin "Run Now" button can trigger the weekly cron
export async function POST(req: NextRequest) {
  return GET(req)
}
