// Server-side only — never import this on the client
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

let vapidInitialised = false
function ensureVapid() {
  if (vapidInitialised) return
  const email  = process.env.VAPID_EMAIL
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privKey = process.env.VAPID_PRIVATE_KEY
  if (!email || !pubKey || !privKey) {
    console.error('[Push] VAPID keys missing — set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in Vercel env vars')
    return
  }
  webpush.setVapidDetails(email, pubKey, privKey)
  vapidInitialised = true
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string = '/'
): Promise<void> {
  try {
    ensureVapid()
    if (!vapidInitialised) {
      console.warn('[Push] Skipping push for user', userId, '— VAPID not configured')
      return
    }

    const admin = createAdminClient()
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', userId)

    if (!subs?.length) return

    const payload = JSON.stringify({ title, body, url })
    const staleIds: string[] = []

    await Promise.allSettled(
      subs.map(async row => {
        try {
          await webpush.sendNotification(row.subscription as webpush.PushSubscription, payload)
        } catch (e: unknown) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) staleIds.push(row.id)
        }
      })
    )

    // Remove stale subscriptions (expired or unsubscribed)
    if (staleIds.length) {
      void admin.from('push_subscriptions').delete().in('id', staleIds)
    }
  } catch {
    // Never throw — push failure must not break the main request
  }
}
