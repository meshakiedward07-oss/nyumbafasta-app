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
    // Fetch all leads (filter nulls in JS to avoid PostgREST filter issues)
    const PAGE = 1000
    let offset = 0
    let totalFixed = 0
    let totalActive = 0
    let totalInactive = 0

    while (true) {
      let allLeads: { id: string; whatsapp_number: string | null }[] | null = null
      let selectError: unknown = null
      try {
        const res = await admin
          .from('leads')
          .select('id, whatsapp_number')
          .range(offset, offset + PAGE - 1)
        allLeads = res.data
        selectError = res.error
      } catch (fetchErr) {
        console.error('[Revalidate WA] Select threw:', String(fetchErr))
        throw fetchErr
      }

      if (selectError) {
        console.error('[Revalidate WA] Select error:', JSON.stringify(selectError))
        throw selectError
      }

      const allFetched = allLeads ?? []
      const leads = allFetched.filter((l: { whatsapp_number: string | null }) => l.whatsapp_number)
      if (!leads || leads.length === 0) break

      const now = new Date().toISOString()
      const regex = /^\+255\d{9}$/

      const activeIds:   string[] = []
      const inactiveIds: string[] = []
      const repairs: Array<{ id: string; whatsapp_number: string }> = []

      for (const lead of leads) {
        const cleaned = cleanPhone(lead.whatsapp_number)
        const isValid = cleaned != null && regex.test(cleaned ?? '')
        if (isValid) activeIds.push(lead.id)
        else         inactiveIds.push(lead.id)
        if (cleaned && cleaned !== lead.whatsapp_number) repairs.push({ id: lead.id, whatsapp_number: cleaned! })
      }

      // Batch UPDATE by status (no upsert — avoids NOT NULL constraint on other columns)
      if (activeIds.length > 0) {
        const { error: e } = await admin.from('leads')
          .update({ whatsapp_status: 'active', whatsapp_verified_at: now })
          .in('id', activeIds)
        if (e) throw e
      }
      if (inactiveIds.length > 0) {
        const { error: e } = await admin.from('leads')
          .update({ whatsapp_status: 'inactive', whatsapp_verified_at: now })
          .in('id', inactiveIds)
        if (e) throw e
      }
      // Individual updates for phone repairs
      for (const r of repairs) {
        await admin.from('leads').update({ whatsapp_number: r.whatsapp_number }).eq('id', r.id)
      }

      totalActive   += activeIds.length
      totalInactive += inactiveIds.length
      totalFixed    += leads.length

      if (allFetched.length < PAGE) break
      offset += PAGE
    }

    return NextResponse.json({
      success: true,
      total: totalFixed,
      active: totalActive,
      inactive: totalInactive,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err)
    console.error('[RevalidateWA]', msg, err)
    return NextResponse.json({ error: 'Hitilafu ya seva', detail: msg }, { status: 500 })
  }
}
