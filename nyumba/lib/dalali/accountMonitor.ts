import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendTextMessage } from '@/lib/whatsapp/client'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Days since registration → which warning to send
const WARNING_SCHEDULE = [
  { day: 7,  type: 'week_1',    label: 'Wiki 1'  },
  { day: 14, type: 'week_2',    label: 'Wiki 2'  },
  { day: 21, type: 'week_3',    label: 'Wiki 3'  },
  { day: 30, type: 'week_4',    label: 'Wiki 4'  },
  { day: 56, type: 'week_8',    label: 'Wiki 8'  },
  { day: 77, type: 'week_11',   label: 'Wiki 11' },
  { day: 88, type: 'final_48h', label: 'Saa 48'  },
  { day: 89, type: 'final_24h', label: 'Saa 24'  },
] as const

// ─── Main monitor ─────────────────────────────────────────────────────────────
export async function monitorDalaliAccounts(): Promise<{
  warningsSent: number
  accountsDeleted: number
  errors: string[]
}> {
  const admin = getAdmin()

  const { data: dalaliList } = await admin
    .from('users')
    .select(`
      id, full_name, phone, email, created_at,
      listing_warnings_count, listing_deadline_days,
      dalali_profiles ( whatsapp_number )
    `)
    .eq('role', 'dalali')
    .eq('is_active', true)

  if (!dalaliList?.length) return { warningsSent: 0, accountsDeleted: 0, errors: [] }

  let warningsSent = 0
  let accountsDeleted = 0
  const errors: string[] = []

  for (const dalali of dalaliList) {
    try {
      const { count: listingCount } = await admin
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', dalali.id)

      if ((listingCount ?? 0) > 0) continue

      const daysSince = Math.floor(
        (Date.now() - new Date(dalali.created_at).getTime()) / 86_400_000,
      )

      const deadlineDays = (dalali.listing_deadline_days as number | null) ?? 90

      if (daysSince >= deadlineDays) {
        const deleted = await deleteDalaliAccount(admin, dalali)
        if (deleted) accountsDeleted++
        continue
      }

      for (const w of WARNING_SCHEDULE) {
        if (daysSince >= w.day && daysSince < w.day + 1) {
          const { data: alreadySent } = await admin
            .from('dalali_account_warnings')
            .select('id')
            .eq('dalali_id', dalali.id)
            .eq('warning_type', w.type)
            .maybeSingle()

          if (!alreadySent) {
            const daysLeft = deadlineDays - daysSince
            const sent = await sendWarning(admin, dalali, w.type, daysLeft)
            if (sent) warningsSent++
          }
        }
      }
    } catch (err: unknown) {
      errors.push(`${dalali.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Admin WhatsApp summary
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
  if (adminPhone && (warningsSent > 0 || accountsDeleted > 0)) {
    sendTextMessage(adminPhone,
      `📊 Ripoti ya Madalali — NyumbaFasta\n\n` +
      `Maonyo yaliyotumwa leo: ${warningsSent}\n` +
      `Akaunti zilizofutwa leo: ${accountsDeleted}\n\n` +
      `Angalia: ${APP_URL}/admin/users`,
    ).catch(console.error)
  }

  return { warningsSent, accountsDeleted, errors }
}

// ─── Send a warning WhatsApp message ─────────────────────────────────────────
async function sendWarning(
  admin: ReturnType<typeof getAdmin>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dalali: any,
  warningType: string,
  daysRemaining: number,
): Promise<boolean> {
  try {
    const waProfile = dalali.dalali_profiles as { whatsapp_number: string | null } | null
    const phone: string | null = waProfile?.whatsapp_number ?? dalali.phone
    if (!phone) return false

    const message = buildWarningMessage(dalali.full_name, warningType, daysRemaining)
    await sendTextMessage(phone, message)

    await admin.from('dalali_account_warnings').insert({
      dalali_id:          dalali.id,
      warning_type:       warningType,
      days_remaining:     daysRemaining,
      message_sent:       message,
      whatsapp_delivered: true,
    })

    await admin.from('users').update({
      listing_warnings_count:        (dalali.listing_warnings_count ?? 0) + 1,
      listing_warning_sent_at:       new Date().toISOString(),
      account_deletion_scheduled_at: new Date(Date.now() + daysRemaining * 86_400_000).toISOString(),
    }).eq('id', dalali.id)

    return true
  } catch (err) {
    console.error('[AccountMonitor] Warning failed:', err)
    return false
  }
}

// ─── Delete a dalali account ──────────────────────────────────────────────────
async function deleteDalaliAccount(
  admin: ReturnType<typeof getAdmin>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dalali: any,
): Promise<boolean> {
  try {
    const waProfile = dalali.dalali_profiles as { whatsapp_number: string | null } | null
    const phone: string | null = waProfile?.whatsapp_number ?? dalali.phone

    if (phone) {
      sendTextMessage(phone,
        `❌ Akaunti Yako Imefutwa — NyumbaFasta\n\n` +
        `Habari ${dalali.full_name as string},\n\n` +
        `Akaunti yako imefutwa kiotomatiki kwa sababu hujaweka listing yoyote ndani ya siku 90 tangu usajili wako.\n\n` +
        `Kama unataka kujiunga tena:\n${APP_URL}/register\n\n` +
        `Kwa msaada: support@nyumbafasta.co`,
      ).catch(console.error)
    }

    await admin.from('dalali_account_warnings').insert({
      dalali_id:          dalali.id,
      warning_type:       'deleted',
      days_remaining:     0,
      message_sent:       'Akaunti imefutwa — siku 90 bila listing',
      whatsapp_delivered: !!phone,
    })

    const { error: rpcError } = await admin.rpc('delete_user_account', {
      target_user_id: dalali.id,
      reason:         'Hakuweka listing ndani ya siku 90 za usajili',
      deleted_by_id:  dalali.id, // system delete — no admin actor
    })

    if (rpcError) {
      await admin.from('users').delete().eq('id', dalali.id)
      await admin.auth.admin.deleteUser(dalali.id)
    }

    console.log('[AccountMonitor] Deleted:', dalali.full_name, dalali.id)
    return true
  } catch (err: unknown) {
    console.error('[AccountMonitor] Delete failed:', dalali.id, err instanceof Error ? err.message : String(err))
    return false
  }
}

// ─── Message templates ────────────────────────────────────────────────────────
function buildWarningMessage(name: string, warningType: string, daysRemaining: number): string {
  const isUrgent = warningType === 'final_48h' || warningType === 'final_24h'
  const timeLeft = warningType === 'final_24h' ? 'masaa 24' : warningType === 'final_48h' ? 'masaa 48' : `siku ${daysRemaining}`

  if (isUrgent) {
    return (
      `🚨 ONYO LA MWISHO — NyumbaFasta\n\n` +
      `Habari ${name}!\n\n` +
      `Akaunti yako itafutwa ndani ya ${timeLeft} kama hutaweka listing yako ya kwanza!\n\n` +
      `⏰ Muda uliosalia: ${timeLeft}\n\n` +
      `Hatua rahisi:\n` +
      `1. Ingia: ${APP_URL}/dashboard/listings\n` +
      `2. Bonyeza "Ongeza Listing Mpya"\n` +
      `3. Jaza maelezo na uwasilishe — imekwisha! ✅\n\n` +
      `Usipoteze akaunti yako — weka listing SASA.`
    )
  }

  if (daysRemaining <= 30) {
    return (
      `⚠️ Onyo la Muhimu — NyumbaFasta\n\n` +
      `Habari ${name}!\n\n` +
      `Bado hujaweka listing yako ya kwanza. Akaunti yako itafutwa ndani ya siku ${daysRemaining}.\n\n` +
      `📋 Hali yako:\n` +
      `- Listings zilizowekwa: 0\n` +
      `- Siku zilizobaki: ${daysRemaining}\n\n` +
      `Weka listing yako ya kwanza sasa:\n${APP_URL}/dashboard/listings`
    )
  }

  return (
    `👋 Habari ${name} — NyumbaFasta\n\n` +
    `Umejiunga NyumbaFasta lakini bado hujaweka listing yako ya kwanza.\n\n` +
    `✅ Kwa nini uweke listing sasa?\n` +
    `- Wateja 1,000+ wanatafuta nyumba kila siku\n` +
    `- Listing yako itaonekana kwa bure\n` +
    `- Unapata mawasiliano ya moja kwa moja\n\n` +
    `Weka listing yako:\n${APP_URL}/dashboard/listings\n\n` +
    `⚠️ Kumbuka: Siku zilizobaki: ${daysRemaining}`
  )
}

// ─── Admin report query (used by API route) ───────────────────────────────────
export async function getDalaliActivityReport(params: {
  riskLevel?: string
  daysWithoutListing?: number
  page?: number
  limit?: number
}): Promise<{
  dalali: unknown[]
  total: number
  summary: { safe: number; new: number; atRisk: number; critical: number; overdue: number }
}> {
  const admin = getAdmin()
  const limit = params.limit ?? 20
  const page  = params.page  ?? 0

  let query = admin
    .from('dalali_listing_activity')
    .select('*', { count: 'exact' })

  if (params.riskLevel && params.riskLevel !== 'all') {
    query = query.eq('risk_level', params.riskLevel)
  }

  if (params.daysWithoutListing) {
    query = query
      .is('last_listing_at', null)
      .gte('days_since_registration', params.daysWithoutListing)
  }

  query = query.range(page * limit, (page + 1) * limit - 1)

  const { data: dalali, count } = await query

  const { data: summaryRows } = await admin
    .from('dalali_listing_activity')
    .select('risk_level')

  const summary = { safe: 0, new: 0, atRisk: 0, critical: 0, overdue: 0 }
  for (const row of summaryRows ?? []) {
    if (row.risk_level === 'safe')     summary.safe++
    else if (row.risk_level === 'new') summary.new++
    else if (row.risk_level === 'at_risk')  summary.atRisk++
    else if (row.risk_level === 'critical') summary.critical++
    else if (row.risk_level === 'overdue')  summary.overdue++
  }

  return { dalali: dalali ?? [], total: count ?? 0, summary }
}
