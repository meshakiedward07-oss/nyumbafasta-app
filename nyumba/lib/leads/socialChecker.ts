// Shared social media link verification logic
// Used by: verify-social API route + auto-verify on manual add + auto-verify after import

export type SocialStatus = 'active' | 'inactive' | 'not_found' | 'unchecked'

export type LeadSocialInput = {
  id: string
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  whatsapp_number: string | null
}

export type SocialVerifyResult = {
  id: string
  updates: Record<string, string>
  summary: { platform: string; status: SocialStatus }[]
}

async function headCheck(url: string, timeout = 9000): Promise<SocialStatus> {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) clean = `https://${clean}`
    const res = await fetch(clean, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    })
    if (res.status === 200 || res.status === 301 || res.status === 302 || res.status === 307) return 'active'
    if (res.status === 404 || res.status === 410 || res.status === 403) return 'not_found'
    return 'inactive'
  } catch {
    return 'unchecked'
  }
}

async function checkFacebook(url: string): Promise<SocialStatus> {
  return headCheck(url)
}

async function checkInstagram(url: string): Promise<SocialStatus> {
  try {
    let clean = url.trim()
    if (!clean.startsWith('http')) {
      clean = `https://www.instagram.com/${clean.replace(/^@/, '').replace(/\/$/, '')}/`
    }
    const res = await fetch(clean, {
      method: 'GET',
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      },
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

// Verify one lead's social links in parallel (all platforms at once)
export async function verifySingleLead(lead: LeadSocialInput): Promise<SocialVerifyResult> {
  const now = new Date().toISOString()
  const updates: Record<string, string> = {}
  const summary: { platform: string; status: SocialStatus }[] = []

  const checks = await Promise.all([
    lead.facebook_url  ? checkFacebook(lead.facebook_url)   : Promise.resolve(null),
    lead.instagram_url ? checkInstagram(lead.instagram_url) : Promise.resolve(null),
    lead.tiktok_url    ? checkTikTok(lead.tiktok_url)       : Promise.resolve(null),
  ])

  const [fbStatus, igStatus, ttStatus] = checks

  if (fbStatus !== null) {
    updates.facebook_status      = fbStatus
    updates.facebook_verified_at = now
    summary.push({ platform: 'facebook', status: fbStatus })
  }
  if (igStatus !== null) {
    updates.instagram_status      = igStatus
    updates.instagram_verified_at = now
    summary.push({ platform: 'instagram', status: igStatus })
  }
  if (ttStatus !== null) {
    updates.tiktok_status      = ttStatus
    updates.tiktok_verified_at = now
    summary.push({ platform: 'tiktok', status: ttStatus })
  }
  if (lead.whatsapp_number) {
    updates.whatsapp_status      = 'has_number'
    updates.whatsapp_verified_at = now
    summary.push({ platform: 'whatsapp', status: 'active' })
  }

  return { id: lead.id, updates, summary }
}

// Verify a batch of leads sequentially (300ms between each to avoid rate limits)
export async function verifyLeadBatch(
  leads: LeadSocialInput[],
  delayMs = 300
): Promise<SocialVerifyResult[]> {
  const results: SocialVerifyResult[] = []
  for (const lead of leads) {
    const result = await verifySingleLead(lead)
    results.push(result)
    if (delayMs > 0 && leads.indexOf(lead) < leads.length - 1) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
  return results
}
