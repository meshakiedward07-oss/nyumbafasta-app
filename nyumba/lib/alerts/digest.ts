import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { generateScorecards } from '@/lib/scorecards/scorer'
import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'

const APP_URL     = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_NUMBER ?? '255615261147'

// ── Helpers ───────────────────────────────────────────────────────────────────

async function sc(q: () => PromiseLike<{ count: number | null }>): Promise<number> {
  try { const r = await q(); return r.count ?? 0 } catch { return 0 }
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `Tsh ${(n / 1_000).toFixed(0)}k`
  return `Tsh ${n}`
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('sw-TZ', {
    timeZone: 'Africa/Dar_es_Salaam',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Digest builder ────────────────────────────────────────────────────────────

export async function buildDailyDigest(): Promise<string> {
  const since24h = new Date(Date.now() - 86_400_000).toISOString()

  // Fetch all data in parallel
  const [
    newClients, newDalali, newListings, unlocks24h,
    openEventsRaw, scorecardReport, sopRaw,
  ] = await Promise.all([
    sc(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'client').gte('created_at', since24h)),
    sc(() => supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('role', 'dalali').gte('created_at', since24h)),
    sc(() => supabaseAdmin.from('listings').select('id', { count: 'exact', head: true }).gte('created_at', since24h)),
    sc(() => supabaseAdmin.from('contact_unlocks').select('id', { count: 'exact', head: true }).not('status', 'eq', 'failed').gte('created_at', since24h)),

    supabaseAdmin.from('alert_events').select('severity, status').eq('status', 'open'),

    generateScorecards(),

    supabaseAdmin
      .from('knowledge_base')
      .select('title, owner_role, review_frequency, last_reviewed_at')
      .eq('audience', 'internal')
      .eq('is_active', true),
  ])

  // ── Open alerts ───────────────────────────────────────────────────────────
  const openEvents  = openEventsRaw.data ?? []
  const critical    = openEvents.filter(e => e.severity === 'critical').length
  const warning     = openEvents.filter(e => e.severity === 'warning').length
  const info        = openEvents.filter(e => e.severity === 'info').length

  // ── Scorecard health ──────────────────────────────────────────────────────
  const depts    = scorecardReport.departments
  const good     = depts.filter(d => d.overall === 'good').length
  const atRisk   = depts.filter(d => d.overall === 'warning').length
  const danger   = depts.filter(d => d.overall === 'critical').length

  const OVERDUE_DAYS: Record<string, number> = {
    weekly: 7, monthly: 30, quarterly: 90, biannual: 180, annually: 365,
  }

  // ── Overdue SOPs ──────────────────────────────────────────────────────────
  const now     = Date.now()
  const overdue = (sopRaw.data ?? []).filter(sop => {
    if (!sop.review_frequency) return false
    if (!sop.last_reviewed_at)  return true
    const days = OVERDUE_DAYS[sop.review_frequency] ?? 30
    return now - new Date(sop.last_reviewed_at).getTime() > days * 86_400_000
  })

  // ── Compose message ───────────────────────────────────────────────────────
  const lines: string[] = [
    `🌅 *Ripoti ya Asubuhi — NyumbaFasta*`,
    `📅 ${dayLabel(new Date())}`,
    ``,
    `━━━ BIASHARA (24h) ━━━`,
    `👥 Wateja wapya: ${newClients}`,
    `🏘️ Madalali wapya: ${newDalali}`,
    `🏠 Orodha mpya: ${newListings}`,
    `💰 Mapato ya kufungua: ${fmtMoney(unlocks24h * 2000)}`,
    ``,
    `━━━ HALI YA IDARA (${depts.length}) ━━━`,
    `✅ Nzuri: ${good}/${depts.length}`,
  ]

  if (atRisk > 0)  lines.push(`⚠️ Angalia: ${atRisk}/${depts.length}`)
  if (danger > 0)  lines.push(`🔴 Hatari: ${danger}/${depts.length}`)

  // List departments not in good health
  const notGood = depts.filter(d => d.overall !== 'good')
  if (notGood.length > 0) {
    for (const d of notGood) {
      const icon = d.overall === 'critical' ? '🔴' : '⚠️'
      lines.push(`  ${icon} ${d.department} (${d.score}/100)`)
    }
  }

  lines.push(``)
  lines.push(`━━━ TAHADHARI ━━━`)

  if (openEvents.length === 0) {
    lines.push(`✅ Hakuna tahadhari wazi`)
  } else {
    if (critical > 0) lines.push(`🔴 Muhimu: ${critical}`)
    if (warning > 0)  lines.push(`🟡 Angalizo: ${warning}`)
    if (info > 0)     lines.push(`ℹ️ Taarifa: ${info}`)
  }

  if (overdue.length > 0) {
    lines.push(``)
    lines.push(`━━━ SOP ZILIZOKWISHA ━━━`)
    for (const s of overdue) {
      lines.push(`⚠️ ${s.title} (${s.owner_role ?? '—'})`)
    }
  }

  lines.push(``)
  lines.push(`🔗 ${APP_URL}/admin/scorecards`)

  return lines.join('\n')
}

// ── Send ──────────────────────────────────────────────────────────────────────

export async function sendDailyDigest(): Promise<void> {
  try {
    const message = await buildDailyDigest()
    const to      = formatPhoneNumber(ADMIN_PHONE)
    await sendTextMessage(to, message)
    console.log('[digest] Sent daily digest to', to.slice(0, 6) + '****')
  } catch (err) {
    console.error('[digest] Failed:', err)
  }
}
