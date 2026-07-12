import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type SocialStatus = 'active' | 'inactive' | 'not_found' | 'unchecked'

async function headCheck(url: string, timeout = 8000): Promise<SocialStatus> {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) clean = `https://${clean}`
    const res = await fetch(clean, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    })
    if (res.status === 200 || res.status === 301 || res.status === 302) return 'active'
    if (res.status === 404 || res.status === 410) return 'not_found'
    return 'inactive'
  } catch {
    return 'unchecked'
  }
}

async function checkInstagram(url: string): Promise<SocialStatus> {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) clean = `https://instagram.com/${clean.replace(/^@/, '')}`
    const res = await fetch(clean, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
    })
    if (res.status === 200) return 'active'
    if (res.status === 404 || res.status === 410) return 'not_found'
    return 'inactive'
  } catch {
    return 'unchecked'
  }
}

async function checkTikTok(url: string): Promise<SocialStatus> {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) {
      const handle = clean.replace(/^@/, '')
      clean = `https://www.tiktok.com/@${handle}`
    }
    return await headCheck(clean)
  } catch {
    return 'unchecked'
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { leadIds } = await req.json() as { leadIds?: string[] }
    if (!leadIds?.length) return NextResponse.json({ error: 'leadIds zinahitajika' }, { status: 400 })

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id,full_name,facebook_url,instagram_url,tiktok_url,whatsapp_number')
      .in('id', leadIds.slice(0, 20))

    if (error) throw error
    if (!leads?.length) return NextResponse.json({ verified: 0 })

    let verified = 0
    for (const lead of leads) {
      const updates: Record<string, string> = {}
      const now = new Date().toISOString()

      if (lead.facebook_url) {
        updates.facebook_status       = await headCheck(lead.facebook_url)
        updates.facebook_verified_at  = now
      }
      if (lead.instagram_url) {
        updates.instagram_status      = await checkInstagram(lead.instagram_url)
        updates.instagram_verified_at = now
      }
      if (lead.tiktok_url) {
        updates.tiktok_status         = await checkTikTok(lead.tiktok_url)
        updates.tiktok_verified_at    = now
      }
      if (lead.whatsapp_number) {
        updates.whatsapp_status = 'has_number'
        updates.whatsapp_verified_at = now
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin.from('leads').update(updates).eq('id', lead.id)
        verified++
      }

      await new Promise(r => setTimeout(r, 300))
    }

    return NextResponse.json({ success: true, verified, total: leads.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
