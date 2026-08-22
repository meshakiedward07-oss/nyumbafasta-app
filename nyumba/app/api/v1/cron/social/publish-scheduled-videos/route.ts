import { type NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { publishVideoNow } from '@/lib/social/publishVideo'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function verifyCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  const xHeader = req.headers.get('x-cron-secret')
  return auth === `Bearer ${secret}` || xHeader === secret
}

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Runs in its own cron slot (separate from cron/daily) since one video
// publish (Cloudinary pre-warm + Instagram container polling) can alone
// take up to ~270s — sharing a time budget with the ~20 other daily
// maintenance tasks in cron/daily would risk starving all of them.
//
// "Panga Ratiba" in the admin Video Upload tab only ever marked
// video_uploads rows as post_status='scheduled' — nothing came back to
// actually publish them. Vercel Cron on this plan only runs once a day,
// so a scheduled video publishes at this job's daily run rather than at
// the exact minute picked — a real improvement over never publishing at
// all. Capped at 2/run so a single invocation can't exceed maxDuration;
// any leftovers are picked up on the next day's run.
async function run() {
  const admin = getAdmin()
  const now = new Date().toISOString()

  const { data: dueVideos, error } = await admin
    .from('video_uploads')
    .select('id, video_url, title, platforms, caption_ig, caption_fb')
    .eq('post_status', 'scheduled')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(2)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let publishedCount = 0
  const results: { id: string; published: boolean; errors: string[] }[] = []

  for (const v of dueVideos ?? []) {
    try {
      const result = await publishVideoNow(v, v.platforms ?? [], v.caption_ig ?? '', v.caption_fb ?? '')
      if (result.published) publishedCount++
      results.push({ id: v.id, published: result.published, errors: result.errors })
    } catch (err) {
      results.push({ id: v.id, published: false, errors: [err instanceof Error ? err.message : String(err)] })
    }
  }

  return Response.json({
    ok: true,
    checked: dueVideos?.length ?? 0,
    published: publishedCount,
    results,
  })
}

// POST — called by admin panel "Run Now" button, if ever added
export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}

// GET — Vercel Cron uses GET by default
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return run()
}
