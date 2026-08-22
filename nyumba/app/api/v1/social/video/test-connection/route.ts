import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

const GRAPH = 'https://graph.facebook.com/v21.0'

type TestResult = {
  ok:       boolean
  name?:    string
  error?:   string
  scopes?:  string[]
  expires?: string   // 'never' | ISO date string
  tokenSource?: string
}

async function testInstagram(): Promise<TestResult> {
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN
  const userId = process.env.INSTAGRAM_USER_ID
  if (!token || !userId) return { ok: false, error: 'INSTAGRAM_ACCESS_TOKEN au INSTAGRAM_USER_ID hazijakonfigurwa' }

  try {
    // Verify the IG user + get token scopes
    const [meRes, debugRes] = await Promise.all([
      fetch(`${GRAPH}/${userId}?fields=id,name,username&access_token=${token}`),
      fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${token}`),
    ])
    const me    = await meRes.json()    as { id?: string; name?: string; username?: string; error?: { message: string } }
    const debug = await debugRes.json() as { data?: { scopes: string[]; is_valid: boolean; expires_at?: number } }

    if (me.error) return { ok: false, error: `IG API: ${me.error.message}` }

    const scopes    = debug.data?.scopes ?? []
    const valid     = debug.data?.is_valid ?? false
    const expiresAt = debug.data?.expires_at  // 0 = never expires (System User token)
    const expired   = expiresAt && expiresAt > 0 ? expiresAt < Date.now() / 1000 : false
    const expiresStr = (!expiresAt || expiresAt === 0)
      ? 'never'
      : new Date(expiresAt * 1000).toISOString()

    if (!valid || expired) {
      return {
        ok: false,
        name: me.username ?? me.name,
        error: expired
          ? `Token imeisha muda wake (${expiresStr}). Tengeneza System User token ya kudumu kwenye Meta Business Suite.`
          : `Token si halali. Angalia INSTAGRAM_ACCESS_TOKEN kwenye Vercel env vars.`,
        scopes,
        expires: expiresStr,
        tokenSource: 'INSTAGRAM_ACCESS_TOKEN',
      }
    }

    const hasPublish = scopes.includes('instagram_content_publish') || scopes.includes('pages_read_engagement')
    if (!hasPublish) {
      return {
        ok: false,
        name: me.username ?? me.name,
        error: 'Ruhusa ya instagram_content_publish haipo. Ongeza ruhusa hii kwenye Meta App.',
        scopes,
        expires: expiresStr,
        tokenSource: 'INSTAGRAM_ACCESS_TOKEN',
      }
    }

    return { ok: true, name: me.username ?? me.name, scopes, expires: expiresStr, tokenSource: 'INSTAGRAM_ACCESS_TOKEN' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Hitilafu ya mtandao' }
  }
}

async function testFacebook(): Promise<TestResult> {
  // Prefer FACEBOOK_PAGE_ACCESS_TOKEN (dedicated permanent FB token) → fallback to INSTAGRAM_ACCESS_TOKEN
  const tokenSource = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ? 'FACEBOOK_PAGE_ACCESS_TOKEN'
    : process.env.INSTAGRAM_ACCESS_TOKEN ? 'INSTAGRAM_ACCESS_TOKEN'
    : process.env.FACEBOOK_ACCESS_TOKEN  ? 'FACEBOOK_ACCESS_TOKEN'
    : null
  const token  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!token || !pageId) return { ok: false, error: 'FACEBOOK_PAGE_ACCESS_TOKEN (au INSTAGRAM_ACCESS_TOKEN) + FACEBOOK_PAGE_ID hazijakonfigurwa' }

  // Read-only checks only: verify the page is reachable + the token was
  // actually GRANTED pages_manage_posts, via debug_token's scopes list.
  // (Previously this created a real feed post on the live Page to test
  // write access, then deleted it without checking the delete succeeded —
  // a failed delete could leave a public stray post. Checking granted
  // scopes proves posting would work without ever posting anything, same
  // approach already used for the Instagram check below.)
  try {
    const [pageRes, debugRes] = await Promise.all([
      fetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${token}`),
      fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${token}`),
    ])
    const pageData = await pageRes.json() as { id?: string; name?: string; error?: { message: string; code?: number } }
    const debug    = await debugRes.json() as { data?: { scopes: string[]; is_valid: boolean; expires_at?: number } }

    if (pageData.error) return { ok: false, error: `FB API: ${pageData.error.message} (code ${pageData.error.code})`, tokenSource: tokenSource ?? undefined }

    const scopes    = debug.data?.scopes ?? []
    const valid     = debug.data?.is_valid ?? false
    const expiresAt = debug.data?.expires_at
    const expired   = expiresAt && expiresAt > 0 ? expiresAt < Date.now() / 1000 : false
    const expiresStr = (!expiresAt || expiresAt === 0) ? 'never' : new Date(expiresAt * 1000).toISOString()

    if (!valid || expired) {
      return {
        ok: false,
        name: pageData.name,
        error: expired
          ? `Token imeisha muda wake (${expiresStr}). Tengeneza System User token ya kudumu kwenye Meta Business Suite.`
          : 'Token si halali — tengeneza System User token mpya.',
        scopes,
        expires: expiresStr,
        tokenSource: tokenSource ?? undefined,
      }
    }

    const hasPublish = scopes.includes('pages_manage_posts')
    if (!hasPublish) {
      return {
        ok: false,
        name: pageData.name,
        scopes,
        expires: expiresStr,
        tokenSource: tokenSource ?? undefined,
        error: 'Token haina ruhusa ya pages_manage_posts. ' +
               'Hatua za kurekebisha: ' +
               '1) Nenda Meta Business Suite → Business Settings → System Users. ' +
               '2) Tengeneza System User na ruhusa: pages_manage_posts, pages_read_engagement, instagram_content_publish. ' +
               '3) Weka token kama FACEBOOK_PAGE_ACCESS_TOKEN kwenye Vercel (token haitaisha kamwe).',
      }
    }

    return { ok: true, name: pageData.name, scopes, expires: expiresStr, tokenSource: tokenSource ?? undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Hitilafu ya mtandao' }
  }
}

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [ig, fb] = await Promise.all([testInstagram(), testFacebook()])
  const allOk = ig.ok && fb.ok

  return NextResponse.json({ ok: allOk, instagram: ig, facebook: fb })
}
