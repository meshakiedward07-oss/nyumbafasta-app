import { createHmac } from 'crypto'

const GRAPH = 'https://graph.facebook.com/v18.0'

const igToken   = () => process.env.INSTAGRAM_ACCESS_TOKEN ?? ''
// Page operations require PAGE token, not System User token
const fbToken   = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN ?? ''
const igUserId  = () => process.env.INSTAGRAM_USER_ID      ?? ''
const fbPageId  = () => process.env.FACEBOOK_PAGE_ID       ?? ''

// ── Signature verification ─────────────────────────────────────────────────

export function verifyMetaSignature(
  rawBody: Buffer,
  signatureHeader: string,
  appSecret: string,
): boolean {
  const [algo, sig] = signatureHeader.split('=')
  if (algo !== 'sha256' || !sig) return false
  const expected = createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return expected === sig
}

// ── Instagram Container API ────────────────────────────────────────────────

export async function createIGImageContainer(
  imageUrl: string,
  caption: string,
): Promise<string> {
  const res = await fetch(`${GRAPH}/${igUserId()}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url:    imageUrl,
      caption,
      access_token: igToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`IG container: ${data.error.message}`)
  return data.id!
}

export async function createIGVideoContainer(
  videoUrl: string,
  caption: string,
  mediaType: 'REELS' | 'VIDEO' = 'REELS',
): Promise<string> {
  const res = await fetch(`${GRAPH}/${igUserId()}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      video_url:    videoUrl,
      caption,
      media_type:   mediaType,
      access_token: igToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`IG video container: ${data.error.message}`)
  return data.id!
}

export async function waitForIGContainer(
  containerId: string,
  maxWaitMs = 30_000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${igToken()}`,
    )
    const data = await res.json() as { status_code?: string }
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR') throw new Error('IG container processing failed')
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error('IG container timed out')
}

export async function publishIGContainer(containerId: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${igUserId()}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: igToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`IG publish: ${data.error.message}`)
  return data.id!
}

// ── Comment Moderation ─────────────────────────────────────────────────────

export async function deleteIGComment(commentId: string): Promise<boolean> {
  try {
    const res  = await fetch(`${GRAPH}/${commentId}?access_token=${igToken()}`, { method: 'DELETE' })
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('[Meta] deleteIGComment failed:', err)
    return false
  }
}

export async function hideIGComment(commentId: string, hide = true): Promise<boolean> {
  try {
    const res  = await fetch(`${GRAPH}/${commentId}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ hide, access_token: igToken() }),
    })
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('[Meta] hideIGComment failed:', err)
    return false
  }
}

export async function deleteFBComment(commentId: string): Promise<boolean> {
  try {
    const res  = await fetch(`${GRAPH}/${commentId}?access_token=${fbToken()}`, { method: 'DELETE' })
    const data = await res.json() as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('[Meta] deleteFBComment failed:', err)
    return false
  }
}

// ── Instagram Carousel API ─────────────────────────────────────────────────

export async function createIGCarouselItemContainer(imageUrl: string): Promise<string> {
  const res = await fetch(`${GRAPH}/${igUserId()}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url:          imageUrl,
      is_carousel_item:   true,
      access_token:       igToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`IG carousel item: ${data.error.message}`)
  return data.id!
}

export async function createIGCarouselContainer(
  childIds: string[],
  caption:  string,
): Promise<string> {
  const res = await fetch(`${GRAPH}/${igUserId()}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type:   'CAROUSEL',
      children:     childIds.join(','),
      caption,
      access_token: igToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`IG carousel container: ${data.error.message}`)
  return data.id!
}

// ── Instagram Interactions ─────────────────────────────────────────────────

export async function replyToIGComment(commentId: string, message: string): Promise<void> {
  await fetch(`${GRAPH}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: igToken() }),
  })
}

export async function sendIGDM(igScopedUserId: string, message: string): Promise<void> {
  await fetch(`${GRAPH}/${igUserId()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient:    { id: igScopedUserId },
      message:      { text: message.slice(0, 1000) },
      access_token: igToken(),
    }),
  })
}

// ── Instagram Metrics ──────────────────────────────────────────────────────

type IGMetrics = {
  likes: number
  comments: number
  reach: number
  impressions: number
  saved: number
}

export async function getIGPostMetrics(igMediaId: string): Promise<IGMetrics> {
  try {
    const fields = 'like_count,comments_count'
    const res = await fetch(
      `${GRAPH}/${igMediaId}?fields=${fields}&access_token=${igToken()}`,
    )
    const data = await res.json() as {
      like_count?: number
      comments_count?: number
      error?: { message: string }
    }
    if (data.error) return { likes: 0, comments: 0, reach: 0, impressions: 0, saved: 0 }

    // Insights endpoint for reach/impressions/saved
    const insRes = await fetch(
      `${GRAPH}/${igMediaId}/insights?metric=reach,impressions,saved&access_token=${igToken()}`,
    )
    const insData = await insRes.json() as { data?: { name: string; values: { value: number }[] }[] }
    const ins: Record<string, number> = {}
    for (const m of insData.data ?? []) ins[m.name] = m.values?.[0]?.value ?? 0

    return {
      likes:       data.like_count     ?? 0,
      comments:    data.comments_count ?? 0,
      reach:       ins['reach']        ?? 0,
      impressions: ins['impressions']  ?? 0,
      saved:       ins['saved']        ?? 0,
    }
  } catch {
    return { likes: 0, comments: 0, reach: 0, impressions: 0, saved: 0 }
  }
}

// ── Facebook Page Posts ────────────────────────────────────────────────────

export async function postToFacebook(
  message: string,
  imageUrl?: string,
): Promise<string> {
  const endpoint = imageUrl ? `${GRAPH}/${fbPageId()}/photos` : `${GRAPH}/${fbPageId()}/feed`
  const body: Record<string, string> = {
    message,
    access_token: fbToken(),
  }
  if (imageUrl) body.url = imageUrl

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } }
  if (data.error) throw new Error(`FB post: ${data.error.message}`)
  return data.post_id ?? data.id ?? ''
}

// ── Facebook Video Upload ──────────────────────────────────────────────────

export async function uploadFacebookVideoUrl(
  videoUrl: string,
  description: string,
  title?: string,
): Promise<string> {
  const res = await fetch(`${GRAPH}/${fbPageId()}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_url:     videoUrl,
      description,
      title:        title ?? 'NyumbaFasta',
      access_token: fbToken(),
    }),
  })
  const data = await res.json() as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`FB video: ${data.error.message}`)
  return data.id ?? ''
}

// ── Facebook Interactions ──────────────────────────────────────────────────

export async function replyToFBComment(commentId: string, message: string): Promise<void> {
  await fetch(`${GRAPH}/${commentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, access_token: fbToken() }),
  })
}

export async function sendFBMessage(recipientId: string, message: string): Promise<void> {
  await fetch(`${GRAPH}/me/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fbToken()}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message:   { text: message.slice(0, 2000) },
    }),
  })
}

// ── Facebook Metrics ───────────────────────────────────────────────────────

type FBMetrics = {
  likes: number
  comments: number
  shares: number
  impressions: number
}

export async function getFBPostMetrics(postId: string): Promise<FBMetrics> {
  try {
    const res = await fetch(
      `${GRAPH}/${postId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${fbToken()}`,
    )
    const data = await res.json() as {
      likes?:    { summary: { total_count: number } }
      comments?: { summary: { total_count: number } }
      shares?:   { count: number }
      error?:    { message: string }
    }
    if (data.error) return { likes: 0, comments: 0, shares: 0, impressions: 0 }

    return {
      likes:       data.likes?.summary?.total_count    ?? 0,
      comments:    data.comments?.summary?.total_count ?? 0,
      shares:      data.shares?.count                  ?? 0,
      impressions: 0,
    }
  } catch {
    return { likes: 0, comments: 0, shares: 0, impressions: 0 }
  }
}
