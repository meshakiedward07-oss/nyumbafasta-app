import { NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

const GRAPH = 'https://graph.facebook.com/v21.0'

// GET /api/v1/social/test-fb
// Diagnostic: test Facebook Page token + permissions, return detailed status
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pageId = process.env.FACEBOOK_PAGE_ID
  const token  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? process.env.FACEBOOK_ACCESS_TOKEN

  const result: Record<string, unknown> = {
    env: {
      FACEBOOK_PAGE_ID:          pageId ? `${pageId.slice(0, 6)}…` : '❌ HAIJAWEKWA',
      FACEBOOK_PAGE_ACCESS_TOKEN: token  ? `${token.slice(0, 12)}… (len=${token.length})` : '❌ HAIJAWEKWA',
    },
  }

  if (!pageId || !token) {
    return NextResponse.json({ ok: false, ...result, error: 'Env vars hazijakonfigurwa' })
  }

  // 1. Validate token via /me
  try {
    const meRes  = await fetch(`${GRAPH}/me?fields=id,name&access_token=${token}`)
    const meData = await meRes.json() as { id?: string; name?: string; error?: { message: string; code?: number } }
    result.token_check = meData.error
      ? { ok: false, error: meData.error.message, code: meData.error.code }
      : { ok: true, id: meData.id, name: meData.name }
  } catch (e) {
    result.token_check = { ok: false, error: String(e) }
  }

  // 2. Check page access
  try {
    const pgRes  = await fetch(`${GRAPH}/${pageId}?fields=id,name,fan_count&access_token=${token}`)
    const pgData = await pgRes.json() as { id?: string; name?: string; fan_count?: number; error?: { message: string; code?: number } }
    result.page_check = pgData.error
      ? { ok: false, error: pgData.error.message, code: pgData.error.code }
      : { ok: true, id: pgData.id, name: pgData.name, fans: pgData.fan_count }
  } catch (e) {
    result.page_check = { ok: false, error: String(e) }
  }

  // 3. Check publish permissions
  try {
    const permRes  = await fetch(`${GRAPH}/me/permissions?access_token=${token}`)
    const permData = await permRes.json() as { data?: { permission: string; status: string }[] }
    const granted  = (permData.data ?? []).filter(p => p.status === 'granted').map(p => p.permission)
    const needed   = ['pages_manage_posts', 'pages_read_engagement']
    result.permissions = {
      granted,
      needed,
      missing: needed.filter(p => !granted.includes(p)),
    }
  } catch (e) {
    result.permissions = { error: String(e) }
  }

  const ok = !!(
    (result.token_check as Record<string,unknown>)?.ok &&
    (result.page_check  as Record<string,unknown>)?.ok
  )

  return NextResponse.json({ ok, ...result })
}
