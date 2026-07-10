import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/security/adminAuth'

// Facebook group URL patterns we handle:
//   https://www.facebook.com/groups/123456789
//   https://www.facebook.com/groups/groupslug
//   https://m.facebook.com/groups/123456789
//   https://fb.com/groups/123456789
//   https://www.facebook.com/share/g/AbCdEfGh/    ← share link (needs redirect)
//   https://fb.me/g/AbCdEfGh                       ← short share link

const GROUP_PATH_RE = /\/groups\/([^/?#&]+)/

// Only these hostnames are allowed to be fetched server-side (prevents SSRF)
const ALLOWED_FB_HOSTS = new Set([
  'www.facebook.com', 'facebook.com', 'm.facebook.com',
  'mobile.facebook.com', 'web.facebook.com',
  'www.fb.com', 'fb.com', 'fb.me', 'l.facebook.com',
])

function isAllowedFacebookHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return ALLOWED_FB_HOSTS.has(hostname)
  } catch {
    return false
  }
}

function extractFromUrl(raw: string): { groupId: string; canonicalUrl: string } | null {
  try {
    const u = new URL(raw)
    const match = u.pathname.match(GROUP_PATH_RE)
    if (!match) return null
    const idOrSlug = match[1]
    return {
      groupId:      idOrSlug,
      canonicalUrl: `https://www.facebook.com/groups/${idOrSlug}`,
    }
  } catch {
    return null
  }
}

function isShareLink(url: string): boolean {
  return (
    url.includes('/share/g/') ||
    url.includes('fb.me/g/') ||
    url.includes('fb.me/e/')
  )
}

async function resolveShareLink(url: string): Promise<string> {
  // Follow the redirect chain; Facebook share links ultimately land on the group page
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Mimic a real mobile browser so Facebook doesn't gate on login for public redirects
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })
    return res.url   // final URL after all redirects
  } catch {
    return url
  }
}

// POST /api/v1/admin/facebook-groups/extract
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { url } = await req.json() as { url?: string }
  if (!url?.trim()) {
    return NextResponse.json({ error: 'URL inahitajika' }, { status: 400 })
  }

  const raw = url.trim()

  // Already a direct group URL — extract immediately
  const direct = extractFromUrl(raw)
  if (direct) {
    return NextResponse.json({
      group_id:      direct.groupId,
      group_url:     direct.canonicalUrl,
      is_numeric_id: /^\d+$/.test(direct.groupId),
    })
  }

  // Share link or unknown — follow the redirect
  if (isShareLink(raw) || raw.includes('fb.me')) {
    if (!isAllowedFacebookHost(raw)) {
      return NextResponse.json({ error: 'URL si ya Facebook inayotambuliwa' }, { status: 400 })
    }
    const resolved = await resolveShareLink(raw)
    const fromRedirect = extractFromUrl(resolved)
    if (fromRedirect) {
      return NextResponse.json({
        group_id:      fromRedirect.groupId,
        group_url:     fromRedirect.canonicalUrl,
        is_numeric_id: /^\d+$/.test(fromRedirect.groupId),
        resolved_from: resolved,
      })
    }
    // Redirect didn't land on a group page (e.g., login wall) — return resolved URL for manual inspection
    return NextResponse.json({
      error:        'Imefuata link lakini haikupata group URL. Facebook inaweza kuhitaji login.',
      resolved_url: resolved,
    }, { status: 422 })
  }

  return NextResponse.json({ error: 'URL si ya Facebook group inayojulikana' }, { status: 400 })
}
