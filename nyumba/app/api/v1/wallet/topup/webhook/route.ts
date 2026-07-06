import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  isWebhookSuccess, getExternalId, verifyWebhookSecret,
  verifyAzamPaySignature, type WebhookPayload,
} from '@/lib/payments/azampay'
import { confirmPendingTopup, failPendingTopup } from '@/lib/payments/wallet'

export async function POST(req: NextRequest) {
  if (!verifyWebhookSecret(req)) {
    console.warn('[Wallet/topup/webhook] Unauthorized — missing or wrong whsec')
    return NextResponse.json({ received: true })
  }
  try {
    const rawBody = await req.text()
    const payload: WebhookPayload = JSON.parse(rawBody)

    if (!(await verifyAzamPaySignature(payload))) {
      console.warn('[Wallet/topup/webhook] RSA signature invalid — rejecting')
      return NextResponse.json({ received: true })
    }

    const externalId = getExternalId(payload)
    const succeeded  = isWebhookSuccess(payload)

    console.log('[Wallet/topup/webhook] externalId:', externalId, '| succeeded:', succeeded)

    if (!externalId) return NextResponse.json({ received: true })

    // Only handle topup refs (WTP- prefix)
    if (!externalId.startsWith('WTP-')) return NextResponse.json({ received: true })

    const admin = createAdminClient()

    if (succeeded) {
      const result = await confirmPendingTopup(externalId, admin)
      console.log('[Wallet/topup/webhook] confirmPendingTopup:', result.message)

      if (result.ok) {
        // Notify user
        const { data: tx } = await admin
          .from('wallet_transactions')
          .select('user_id, amount')
          .eq('external_id', externalId)
          .maybeSingle()

        if (tx) {
          await admin.from('notifications').insert({
            user_id: tx.user_id,
            title:   '✅ Wallet Imewekwa!',
            body:    `Tsh ${(tx.amount as number).toLocaleString()} imeongezwa kwenye wallet yako.`,
            type:    'wallet_topup',
            is_read: false,
          })
        }
      }
    } else {
      await failPendingTopup(externalId, admin)
      console.log('[Wallet/topup/webhook] Topup failed for:', externalId)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Wallet/topup/webhook] Error:', err)
    return NextResponse.json({ received: true })
  }
}
