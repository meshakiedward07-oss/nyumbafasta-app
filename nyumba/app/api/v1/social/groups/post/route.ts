import { NextRequest, NextResponse } from 'next/server'
import { postToAllGroups, postToFacebookGroup, getAllGroups, buildGroupMessage } from '@/lib/social/facebookGroups'
import { watermarkImage } from '@/lib/media/watermark'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'
import { requireAdminUser } from '@/lib/security/adminAuth'

export const maxDuration = 60

// POST /api/v1/social/groups/post
// Body: { listingId, groupIds? }  — omit groupIds to post to all active groups
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { listingId, groupIds } = await req.json() as {
    listingId: string
    groupIds?: string[]
  }

  if (!listingId) {
    return NextResponse.json({ error: 'listingId inahitajika' }, { status: 400 })
  }

  const { data: listing, error } = await supabaseAdmin
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .single()

  if (error || !listing) {
    return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })
  }

  const l        = listing as Listing
  const rawImage = l.images?.[0] ?? null
  const imageUrl = rawImage ? await watermarkImage(rawImage) : undefined

  try {
    let results

    if (groupIds && groupIds.length > 0) {
      const allGroups = await getAllGroups()
      const targets   = allGroups.filter(g => groupIds.includes(g.group_id as string))
      const message   = buildGroupMessage(l)

      results = []
      for (const g of targets) {
        const r = await postToFacebookGroup(g.group_id as string, message, imageUrl)
        results.push({ groupId: g.group_id, groupName: g.group_name, ...r })
        if (results.length < targets.length) await new Promise(res => setTimeout(res, 3000))
      }
    } else {
      results = await postToAllGroups(l, imageUrl)
    }

    const posted = results.filter(r => r.success).length
    return NextResponse.json({ ok: true, posted, total: results.length, results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    console.error('[Groups/post]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
