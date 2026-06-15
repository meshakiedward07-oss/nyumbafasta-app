import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { postToAllGroups, postToFacebookGroup, getAllGroups } from '@/lib/social/facebookGroups'
import { watermarkImage } from '@/lib/media/watermark'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'

export const maxDuration = 60

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// POST /api/v1/social/groups/post
// Body: { listingId, groupIds? }  — omit groupIds to post to all active groups
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
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

function buildGroupMessage(listing: Listing): string {
  const price    = listing.price_monthly?.toLocaleString('sw-TZ') ?? '0'
  const typeMap: Record<string, string> = {
    chumba: 'CHUMBA', apartment: 'APARTMENT', nyumba: 'NYUMBA', studio: 'STUDIO',
  }
  const typeLabel = typeMap[listing.type] ?? listing.type.toUpperCase()
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  return [
    `🏠 ${typeLabel} INAPANGISHWA — ${listing.district}, ${listing.region}`,
    `💰 Bei: Tsh ${price}/mwezi`,
    listing.description ? `\n${listing.description.slice(0, 200)}` : '',
    `\n🌐 ${appUrl}/listings/${listing.id}`,
    `#NyumbaFasta #${listing.district.replace(/\s/g, '')} #NyumbaTanzania`,
  ].join('\n').trim()
}
