import { NextRequest } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { resolveRecipients, executeBroadcast } from '@/lib/whatsapp/broadcastSender'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getAdmin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function verify(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// GET — called by Vercel Cron every hour
// Picks up whatsapp_broadcasts with status='scheduled' and scheduled_at <= now()
export async function GET(req: NextRequest) {
  if (!verify(req)) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdmin()
  const now = new Date().toISOString()

  // Fetch all due scheduled broadcasts and atomically mark them 'sending'
  // (RLS is bypassed via service role, so concurrent cron invocations are safe:
  //  the update returns only rows that were still 'scheduled' when this ran)
  const { data: due, error } = await admin
    .from('whatsapp_broadcasts')
    .update({ status: 'sending' })
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .select('id, target, message, tone, phones_json')

  if (error) {
    console.error('[Cron/Broadcast] DB error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!due?.length) {
    return Response.json({ ok: true, processed: 0, message: 'Hakuna matangazo yaliyopangwa kwa sasa' })
  }

  const results: Array<{
    id: string; sentCount: number; failedCount: number; error?: string
  }> = []

  for (const broadcast of due) {
    try {
      const phones = Array.isArray(broadcast.phones_json) ? broadcast.phones_json as string[] : undefined
      const { recipients, error: recipientErr } = await resolveRecipients(broadcast.target, phones)

      if (recipientErr || !recipients.length) {
        // Mark failed — target produced no recipients
        await admin.from('whatsapp_broadcasts').update({
          status:      'failed',
          failed_count: 0,
          completed_at: new Date().toISOString(),
        }).eq('id', broadcast.id)
        results.push({ id: broadcast.id, sentCount: 0, failedCount: 0, error: recipientErr ?? 'No recipients' })
        continue
      }

      const { sentCount, failedCount } = await executeBroadcast(
        broadcast.id, recipients, broadcast.message, broadcast.tone,
      )
      results.push({ id: broadcast.id, sentCount, failedCount })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Cron/Broadcast] failed for', broadcast.id, msg)
      await admin.from('whatsapp_broadcasts').update({
        status: 'failed', completed_at: new Date().toISOString(),
      }).eq('id', broadcast.id)
      results.push({ id: broadcast.id, sentCount: 0, failedCount: 0, error: msg })
    }
  }

  return Response.json({ ok: true, processed: due.length, results })
}
