import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { cleanPhone } from '@/lib/leads/cleanPhone'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Bulk re-validate WhatsApp numbers for ALL leads.
// Pure format check — no HTTP calls, so processes thousands of rows quickly.
export async function POST() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  try {
    console.log('[RevalidateWA] step1: starting select')
    const { data: allLeads, error: selectError } = await admin
      .from('leads')
      .select('id, whatsapp_number')
      .limit(1000)

    console.log('[RevalidateWA] step2: select done, rows:', allLeads?.length ?? 'null', 'err:', JSON.stringify(selectError))

    if (selectError) throw selectError

    const leads = (allLeads ?? []).filter((l) => l.whatsapp_number)
    console.log('[RevalidateWA] step3: leads with phone:', leads.length)

    if (leads.length === 0) {
      return NextResponse.json({ success: true, total: 0, active: 0, inactive: 0 })
    }

    const now = new Date().toISOString()
    const regex = /^\+255\d{9}$/
    const activeIds: string[] = []
    const inactiveIds: string[] = []
    const repairs: Array<{ id: string; whatsapp_number: string }> = []

    for (const lead of leads) {
      const cleaned = cleanPhone(lead.whatsapp_number)
      const isValid = cleaned != null && regex.test(cleaned)
      if (isValid) activeIds.push(lead.id)
      else         inactiveIds.push(lead.id)
      if (cleaned && cleaned !== lead.whatsapp_number) repairs.push({ id: lead.id, whatsapp_number: cleaned })
    }

    console.log('[RevalidateWA] step4: active:', activeIds.length, 'inactive:', inactiveIds.length, 'repairs:', repairs.length)

    if (activeIds.length > 0) {
      console.log('[RevalidateWA] step5a: updating active')
      const { error: e } = await admin.from('leads')
        .update({ whatsapp_status: 'active', whatsapp_verified_at: now })
        .in('id', activeIds)
      console.log('[RevalidateWA] step5a done, err:', JSON.stringify(e))
      if (e) throw e
    }

    if (inactiveIds.length > 0) {
      console.log('[RevalidateWA] step5b: updating inactive')
      const { error: e } = await admin.from('leads')
        .update({ whatsapp_status: 'inactive', whatsapp_verified_at: now })
        .in('id', inactiveIds)
      console.log('[RevalidateWA] step5b done, err:', JSON.stringify(e))
      if (e) throw e
    }

    for (const r of repairs) {
      await admin.from('leads').update({ whatsapp_number: r.whatsapp_number }).eq('id', r.id)
    }

    console.log('[RevalidateWA] step6: done')
    return NextResponse.json({
      success: true,
      total: leads.length,
      active: activeIds.length,
      inactive: inactiveIds.length,
    })
  } catch (err) {
    const detail = err instanceof Error
      ? err.message
      : (typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err))
    console.error('[RevalidateWA] CAUGHT:', detail)
    return NextResponse.json({ error: 'Hitilafu ya seva', detail }, { status: 500 })
  }
}
