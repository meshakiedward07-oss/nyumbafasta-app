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
    const { data: allLeads, error: selectError } = await admin
      .from('leads')
      .select('id, whatsapp_number')
      .limit(1000)

    if (selectError) throw selectError

    const leads = (allLeads ?? []).filter((l) => l.whatsapp_number)

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

    // Batch UPDATE in chunks of 100 to keep URL length under server limits
    // (650+ UUIDs in one in.() filter exceeds server's URL length limit → 400)
    const BATCH = 100
    const chunks = (ids: string[]) =>
      Array.from({ length: Math.ceil(ids.length / BATCH) }, (_, i) => ids.slice(i * BATCH, i * BATCH + BATCH))

    for (const batch of chunks(activeIds)) {
      const { error: e } = await admin.from('leads')
        .update({ whatsapp_status: 'active', whatsapp_verified_at: now }).in('id', batch)
      if (e) throw e
    }
    for (const batch of chunks(inactiveIds)) {
      const { error: e } = await admin.from('leads')
        .update({ whatsapp_status: 'inactive', whatsapp_verified_at: now }).in('id', batch)
      if (e) throw e
    }
    for (const r of repairs) {
      await admin.from('leads').update({ whatsapp_number: r.whatsapp_number }).eq('id', r.id)
    }

    return NextResponse.json({
      success: true,
      total: leads.length,
      active: activeIds.length,
      inactive: inactiveIds.length,
    })
  } catch (err) {
    const detail = typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err)
    console.error('[RevalidateWA] error:', detail)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
