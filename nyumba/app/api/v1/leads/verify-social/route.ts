import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { verifyLeadBatch } from '@/lib/leads/socialChecker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { leadIds } = await req.json() as { leadIds?: string[] }
    if (!leadIds?.length) return NextResponse.json({ error: 'leadIds zinahitajika' }, { status: 400 })

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id,facebook_url,instagram_url,tiktok_url,whatsapp_number')
      .in('id', leadIds.slice(0, 20))

    if (error) throw error
    if (!leads?.length) return NextResponse.json({ verified: 0 })

    const leadsWithSocial = leads.filter(l =>
      l.facebook_url || l.instagram_url || l.tiktok_url || l.whatsapp_number
    )

    const results = await verifyLeadBatch(leadsWithSocial)

    let verified = 0
    for (const result of results) {
      if (Object.keys(result.updates).length > 0) {
        await supabaseAdmin.from('leads').update(result.updates).eq('id', result.id)
        verified++
      }
    }

    const statusCounts = results.flatMap(r => r.summary).reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      verified,
      total: leads.length,
      statusCounts,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
