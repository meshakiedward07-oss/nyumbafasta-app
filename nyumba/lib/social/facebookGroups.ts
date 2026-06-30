import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { Listing } from '@/lib/types/database'

const GRAPH    = 'https://graph.facebook.com/v21.0'
const fbToken  = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN ?? ''

export type GroupPostResult = {
  groupId:   string
  groupName: string
  success:   boolean
  postId?:   string
  error?:    string
}

// ── Post to a single Facebook Group ───────────────────────────────────────────

export async function postToFacebookGroup(
  groupId:   string,
  message:   string,
  imageUrl?: string,
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const endpoint = imageUrl
      ? `${GRAPH}/${groupId}/photos`
      : `${GRAPH}/${groupId}/feed`

    const body: Record<string, string> = {
      access_token: fbToken(),
    }
    if (imageUrl) {
      body.url     = imageUrl
      body.caption = message
    } else {
      body.message = message
    }

    const res  = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } }

    if (data.error) {
      console.error('[FB Groups] Error posting to', groupId, ':', data.error.message)
      return { success: false, error: data.error.message }
    }

    const postId = data.post_id ?? data.id ?? ''
    console.log('[FB Groups] Posted to', groupId, '— postId:', postId)
    return { success: true, postId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FB Groups] Exception posting to', groupId, ':', msg)
    return { success: false, error: msg }
  }
}

// ── Post to all active groups ─────────────────────────────────────────────────

export async function postToAllGroups(
  listing:   Listing,
  imageUrl?: string,
): Promise<GroupPostResult[]> {
  const { data: groups } = await supabaseAdmin
    .from('fb_posting_groups')
    .select('*')
    .eq('is_active', true)
    .order('last_posted_at', { ascending: true, nullsFirst: true })

  if (!groups || groups.length === 0) {
    console.log('[FB Groups] No active groups configured')
    return []
  }

  console.log('[FB Groups] Posting to', groups.length, 'groups for listing', listing.id)
  const message = buildGroupMessage(listing)
  const results: GroupPostResult[] = []

  for (const group of groups) {
    if (results.length > 0) {
      await new Promise(r => setTimeout(r, 3000))
    }

    const result = await postToFacebookGroup(group.group_id, message, imageUrl)

    // Record result in DB (failure of one group must not stop others)
    try {
      await supabaseAdmin.from('facebook_group_posts').insert({
        listing_id:    listing.id,
        group_id:      group.group_id,
        group_name:    group.group_name,
        post_id:       result.postId ?? null,
        message,
        image_url:     imageUrl ?? null,
        status:        result.success ? 'posted' : 'failed',
        error_message: result.error ?? null,
        posted_at:     result.success ? new Date().toISOString() : null,
      })

      if (result.success) {
        await supabaseAdmin
          .from('fb_posting_groups')
          .update({
            last_posted_at: new Date().toISOString(),
            post_count:     (group.post_count ?? 0) + 1,
          })
          .eq('id', group.id)
      }
    } catch (dbErr) {
      console.error('[FB Groups] DB save failed for group', group.group_id, dbErr)
    }

    console.log('[FB Groups]', group.group_name, result.success ? '✅' : '❌', result.error ?? '')
    results.push({ groupId: group.group_id, groupName: group.group_name, ...result })
  }

  return results
}

// ── Build message for group posts ─────────────────────────────────────────────

function buildGroupMessage(listing: Listing): string {
  const price    = listing.price_monthly?.toLocaleString('sw-TZ') ?? '0'
  const typeMap: Record<string, string> = {
    chumba: 'CHUMBA', apartment: 'APARTMENT', nyumba: 'NYUMBA', studio: 'STUDIO',
  }
  const typeLabel = typeMap[listing.type] ?? listing.type.toUpperCase()
  const furnished = listing.furnished === 'furnished'
    ? '✅ Furnished' : listing.furnished === 'semi'
    ? '🛋️ Semi-furnished' : '📦 Empty'

  const amenities = listing.amenities?.slice(0, 4).join(' • ') ?? ''
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

  return [
    `🏠 ${typeLabel} INAPANGISHWA — ${listing.district}, ${listing.region}`,
    '',
    `💰 Bei: Tsh ${price}/mwezi`,
    listing.bedrooms ? `🛏️ Vyumba: ${listing.bedrooms}` : '',
    `🛋️ Samani: ${furnished}`,
    amenities ? `✨ ${amenities}` : '',
    listing.description ? `\n${listing.description.slice(0, 200)}` : '',
    '',
    `📸 Angalia picha zaidi na wasiliana na dalali:`,
    `🌐 ${appUrl}/listings/${listing.id}`,
    '',
    `#NyumbaFasta #Nyumba${listing.district.replace(/\s/g, '')} #NyumbaTanzania #${listing.region.replace(/\s/g, '')}`,
  ].filter(l => l !== undefined).join('\n').trim()
}

// ── Manage groups (CRUD helpers used by API routes) ───────────────────────────

export async function getAllGroups() {
  const { data } = await supabaseAdmin
    .from('fb_posting_groups')
    .select('*')
    .order('is_active', { ascending: false })
    .order('post_count',  { ascending: false })
  return data ?? []
}

export async function addGroup(params: {
  groupId:      string
  groupName:    string
  groupUrl?:    string
  membersCount?: number
  category?:    string
}) {
  const { data, error } = await supabaseAdmin
    .from('fb_posting_groups')
    .insert({
      group_id:      params.groupId,
      group_name:    params.groupName,
      group_url:     params.groupUrl ?? null,
      members_count: params.membersCount ?? null,
      category:      params.category ?? 'nyumba',
      is_active:     true,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function toggleGroup(id: string, isActive: boolean) {
  const { error } = await supabaseAdmin
    .from('fb_posting_groups')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteGroup(id: string) {
  const { error } = await supabaseAdmin
    .from('fb_posting_groups')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getRecentGroupPosts(limit = 20) {
  const { data } = await supabaseAdmin
    .from('facebook_group_posts')
    .select('*, listings(title, district, region)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}
