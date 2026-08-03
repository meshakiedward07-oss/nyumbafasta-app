import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email/resend'
import { emailBase } from '@/lib/email/templates'
import { checkStaleListings } from '@/lib/listings/staleListingCheck'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
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

  // ── Phase 12: Department Scorecards + SOP Ack sections (pre-generate HTML) ──
  let scorecardSectionHtml = ''
  let sopAckSectionHtml    = ''
  try {
    const { generateScorecards } = await import('@/lib/scorecards/scorer')
    const report = await generateScorecards()

    const S_EMOJI = { good: '✅', warning: '⚠️', critical: '🔴' } as const
    const S_LABEL = { good: 'Nzuri', warning: 'Angalia', critical: 'Hatari' } as const
    const S_COLOR = { good: '#16a34a', warning: '#d97706', critical: '#dc2626' } as const

    const deptRows = report.departments.map(d => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${S_EMOJI[d.overall]} ${d.department}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:700;font-variant-numeric:tabular-nums;color:${S_COLOR[d.overall]}">${d.score}/100</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:${S_COLOR[d.overall]}">${S_LABEL[d.overall]}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:${(d.open_alerts ?? 0) > 0 ? '#d97706' : '#9ca3af'}">${(d.open_alerts ?? 0) > 0 ? `⚠️ ${d.open_alerts}` : '—'}</td>
        </tr>`).join('')

    scorecardSectionHtml = `
        <span style="font-size:18px;font-weight:700;color:#1D9E75;display:block;margin:28px 0 10px">📊 Hali ya Idara — Wiki Hii</span>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
          <tr style="background:#1D9E75;color:white">
            <td style="padding:10px 12px;font-weight:bold">Idara</td>
            <td style="padding:10px 12px;font-weight:bold;text-align:center">Alama</td>
            <td style="padding:10px 12px;font-weight:bold;text-align:center">Hali</td>
            <td style="padding:10px 12px;font-weight:bold;text-align:center">Tahadhari</td>
          </tr>
          ${deptRows}
        </table>
        <a href="${APP_URL}/admin/scorecards" style="display:inline-block;margin:6px 0 0;font-size:12px;color:#1D9E75;text-decoration:none">Kadi kamili za idara →</a>`

    // SOP acknowledgement stats
    const adminDb = getAdmin()
    const { data: sops } = await adminDb
      .from('knowledge_base')
      .select('id, title, last_reviewed_at')
      .eq('audience', 'internal')
      .eq('is_active', true)
      .order('title')

    if (sops && sops.length > 0) {
      const sopIds = sops.map(s => s.id)
      let acks: { sop_id: string; sop_version: string | null }[] = []
      try {
        const { data } = await adminDb
          .from('sop_acknowledgements')
          .select('sop_id, sop_version')
          .in('sop_id', sopIds)
        acks = (data ?? []) as { sop_id: string; sop_version: string | null }[]
      } catch { /* table not yet created */ }

      const totalBySop = new Map<string, number>()
      const staleBySop  = new Map<string, number>()
      const versionMap  = new Map(sops.map(s => [s.id, s.last_reviewed_at]))

      for (const ack of acks) {
        totalBySop.set(ack.sop_id, (totalBySop.get(ack.sop_id) ?? 0) + 1)
        const curVer = versionMap.get(ack.sop_id)
        if (curVer && ack.sop_version !== curVer) {
          staleBySop.set(ack.sop_id, (staleBySop.get(ack.sop_id) ?? 0) + 1)
        }
      }

      const sopRows = sops.map(s => {
        const total   = totalBySop.get(s.id) ?? 0
        const stale   = staleBySop.get(s.id) ?? 0
        const current = total - stale
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6">${s.title}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#16a34a;font-weight:700">${current}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:${stale > 0 ? '#d97706' : '#9ca3af'}">${stale > 0 ? `⚠️ ${stale}` : '—'}</td>
          </tr>`
      }).join('')

      sopAckSectionHtml = `
        <span style="font-size:18px;font-weight:700;color:#1D9E75;display:block;margin:24px 0 10px">📋 Uthibitisho wa SOP</span>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
          <tr style="background:#1D9E75;color:white">
            <td style="padding:10px 12px;font-weight:bold">Jina la SOP</td>
            <td style="padding:10px 12px;font-weight:bold;text-align:center">✅ Sasa Hivi</td>
            <td style="padding:10px 12px;font-weight:bold;text-align:center">⚠️ Waliokwama</td>
          </tr>
          ${sopRows}
        </table>
        <a href="${APP_URL}/admin/knowledge" style="display:inline-block;margin:6px 0 0;font-size:12px;color:#1D9E75;text-decoration:none">Angalia SOP zote →</a>`
    }

    results.push('✅ Scorecard + SOP sections zinasubiri email')
  } catch (e) {
    errors.push(`❌ Scorecard/SOP section: ${String(e)}`)
  }

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

    await sendMail({
      to: adminEmail,
      subject: `📊 Weekly Report NyumbaFasta — ${now.toLocaleDateString('sw-TZ')}`,
      html: emailBase(`
        <span style="font-size:22px;font-weight:700;color:#111827;margin:0 0 4px;display:block">📊 Weekly Report NyumbaFasta</span>
        <span style="font-size:14px;color:#64748b;display:block;margin:0 0 20px">${weekAgo.toLocaleDateString('sw-TZ')} — ${now.toLocaleDateString('sw-TZ')}</span>

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
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

        <span style="font-size:18px;font-weight:700;color:#1D9E75;display:block;margin:24px 0 8px">💰 Mapato ya Wiki — ${fmtTZS(income.total)}</span>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:14px">
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
        <span style="font-size:12px;color:#9ca3af;display:block;margin:8px 0 24px">Miamala yote: ${income.transactionCount}</span>

        ${scorecardSectionHtml}
        ${sopAckSectionHtml}

        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px">
          <tr>
            <td style="padding:0 8px 0 0">
              <a href="${APP_URL}/admin" style="background:#1D9E75;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px">Fungua Admin Panel →</a>
            </td>
            <td>
              <a href="${APP_URL}/admin/accounting" style="background:#f3f4f6;color:#374151;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;font-size:14px">Hesabu Kamili →</a>
            </td>
          </tr>
        </table>
      `, `Weekly report — ${now.toLocaleDateString('sw-TZ')}`),
    })
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
      await sendMail({
        to: emailAddr,
        subject: '📈 Una Leads Zinaokusubiri!',
        html: emailBase(`
          <span style="font-size:22px;font-weight:700;color:#111827;margin:0 0 12px;display:block">Habari ${fullName}!</span>
          <span style="font-size:15px;color:#4b5563;line-height:1.7;margin:0 0 16px;display:block">Una leads ambazo bado haujafuatilia wiki nzima. Wasiliana nao leo — wateja wanakusubiri!</span>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">
            <tr><td align="center">
              <a href="${APP_URL}/admin/leads" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px">🏠 Angalia Leads →</a>
            </td></tr>
          </table>
        `, 'Una leads zinaokusubiri!'),
      })
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

  // ── Stale brokerage requests (pending > 7 days) ───────
  try {
    const admin = getAdmin()
    const { count: stalePending } = await admin
      .from('brokerage_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', weekAgo.toISOString())

    if ((stalePending ?? 0) > 0) {
      // In-app notifications for all admins
      const { data: admins } = await admin
        .from('users')
        .select('id')
        .eq('role', 'admin')

      const notifs = (admins ?? []).map(a => ({
        user_id:  a.id,
        title:    `⚠️ Maombi ya Brokerage Yaliyokwama: ${stalePending}`,
        body:     `Kuna maombi ${stalePending} ya brokerage ambayo yamekuwa katika hali ya "pending" kwa zaidi ya wiki moja. Tafadhali yafuatilie.`,
        type:     'brokerage_stale',
        is_read:  false,
      }))
      if (notifs.length > 0) await admin.from('notifications').insert(notifs)
    }
    results.push(`✅ Stale brokerage check: ${stalePending ?? 0} pending > 7 days`)
  } catch (e) {
    errors.push(`❌ Stale brokerage: ${String(e)}`)
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
