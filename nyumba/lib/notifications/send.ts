// Server-side only — never import this on the client
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

let vapidInitialised = false
function ensureVapid() {
  if (vapidInitialised) return
  const email  = process.env.VAPID_EMAIL
  const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privKey = process.env.VAPID_PRIVATE_KEY
  if (!email || !pubKey || !privKey) return
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
    if (!vapidInitialised) return

    const admin = createAdminClient()
    const { data } = await admin
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId)
      .single()

    if (!data?.subscription) return

    await webpush.sendNotification(
      data.subscription as webpush.PushSubscription,
      JSON.stringify({ title, body, url })
    )
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    // 410 Gone / 404 = subscription expired → clean up
    if (status === 410 || status === 404) {
      try {
        const admin = createAdminClient()
        await admin.from('push_subscriptions').delete().eq('user_id', userId)
      } catch {}
    }
    // Never throw — push failure must not break the main request
  }
}
