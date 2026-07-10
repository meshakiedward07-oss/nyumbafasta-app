import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

const GRAPH = 'https://graph.facebook.com/v21.0'

type TestResult = {
  ok:    boolean
  name?: string
  error?: string
  scopes?: string[]
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

    const scopes   = debug.data?.scopes ?? []
    const valid    = debug.data?.is_valid ?? false
    const expiresAt = debug.data?.expires_at
    const expired  = expiresAt ? expiresAt < Date.now() / 1000 : false

    if (!valid || expired) {
      return {
        ok: false,
        name: me.username ?? me.name,
        error: expired
          ? `Token imeisha muda wake. Tengeneza token mpya kwenye Meta Business Suite.`
          : `Token si halali. Angalia INSTAGRAM_ACCESS_TOKEN kwenye Vercel env vars.`,
        scopes,
      }
    }

    const hasPublish = scopes.includes('instagram_content_publish') || scopes.includes('pages_read_engagement')
    if (!hasPublish) {
      return {
        ok: false,
        name: me.username ?? me.name,
        error: 'Ruhusa ya instagram_content_publish haipo. Ongeza ruhusa hii kwenye Meta App.',
        scopes,
      }
    }

    return { ok: true, name: me.username ?? me.name, scopes }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Hitilafu ya mtandao' }
  }
}

async function testFacebook(): Promise<TestResult> {
  const token  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!token || !pageId) return { ok: false, error: 'FACEBOOK_PAGE_ACCESS_TOKEN au FACEBOOK_PAGE_ID hazijakonfigurwa' }

  try {
    const res  = await fetch(`${GRAPH}/${pageId}?fields=id,name,fan_count&access_token=${token}`)
    const data = await res.json() as { id?: string; name?: string; fan_count?: number; error?: { message: string; code?: number } }

    if (data.error) return { ok: false, error: `FB API: ${data.error.message} (code ${data.error.code})` }
    return { ok: true, name: data.name }
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
