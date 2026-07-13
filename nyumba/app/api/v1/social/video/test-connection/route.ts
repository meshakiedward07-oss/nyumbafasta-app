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
  // INSTAGRAM_ACCESS_TOKEN is the actual FB Page Token (resolves /me → page ID)
  const token  = process.env.INSTAGRAM_ACCESS_TOKEN ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN
  const pageId = process.env.FACEBOOK_PAGE_ID
  if (!token || !pageId) return { ok: false, error: 'INSTAGRAM_ACCESS_TOKEN au FACEBOOK_PAGE_ID hazijakonfigurwa' }

  try {
    // 1. Verify page is accessible (read)
    const pageRes  = await fetch(`${GRAPH}/${pageId}?fields=id,name&access_token=${token}`)
    const pageData = await pageRes.json() as { id?: string; name?: string; error?: { message: string; code?: number } }
    if (pageData.error) return { ok: false, error: `FB API: ${pageData.error.message} (code ${pageData.error.code})` }

    // 2. Try a test feed post to verify pages_manage_posts permission
    const testRes  = await fetch(`${GRAPH}/${pageId}/feed`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message:      `NyumbaFasta connection test ${Date.now()} [auto-delete]`,
        access_token: token,
      }),
    })
    const testData = await testRes.json() as { id?: string; error?: { message: string; code?: number } }

    if (testData.error) {
      const msg  = testData.error.message
      const code = testData.error.code ?? 0
      if (code === 200) {
        return {
          ok:    false,
          name:  pageData.name,
          error: 'Token haina ruhusa ya pages_manage_posts. ' +
                 'Hatua za kurekebisha: ' +
                 '1) Nenda Meta for Developers → App yako → Permissions → ongeza pages_manage_posts. ' +
                 '2) Tengeneza token mpya ukitumia /{user-id}/accounts au Meta Business Suite → System Users. ' +
                 '3) Weka token hiyo kama INSTAGRAM_ACCESS_TOKEN kwenye Vercel.',
        }
      }
      return { ok: false, name: pageData.name, error: `FB post test: ${msg}` }
    }

    // Post succeeded — immediately delete it
    if (testData.id) {
      await fetch(`${GRAPH}/${testData.id}?access_token=${token}`, { method: 'DELETE' })
    }

    return { ok: true, name: pageData.name }
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
