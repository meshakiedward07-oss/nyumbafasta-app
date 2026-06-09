import crypto from 'crypto'

const API_BASE  = 'https://apigw.selcom.net/v1'
const API_KEY   = process.env.SELCOM_API_KEY    ?? ''
const API_SECRET= process.env.SELCOM_API_SECRET ?? ''
const VENDOR_ID = process.env.SELCOM_VENDOR_ID  ?? ''

const IS_DEV = !API_KEY || API_KEY.startsWith('test_')

// ── Provider codes → Selcom payment_method field ──────────
export const PROVIDER_MAP: Record<string, string> = {
  mpesa:      'MPESA',
  mixyyas:    'TIGOPESA',   // MiXbyYAS (ex-TigoPesa) uses same gateway
  airtel:     'AIRTEL',
  halopesa:   'HALOPESA',
  mastercard: 'CARD',
  visa:       'CARD',
}

export type PaymentProvider = 'mpesa' | 'mixyyas' | 'airtel' | 'halopesa' | 'mastercard' | 'visa'

function timestamp(): string {
  return new Date().toISOString().replace('Z', '+00:00')
}

function sign(body: string, ts: string): string {
  const payload = `${ts}${body}`
  return crypto.createHmac('sha256', API_SECRET).update(payload).digest('base64')
}

function selcomHeaders(body: string): Record<string, string> {
  const ts = timestamp()
  return {
    'Content-Type': 'application/json',
    Authorization:      `SELCOM ${API_KEY}`,
    Digest:             sign(body, ts),
    'Digest-Method':    'HS256',
    Timestamp:          ts,
  }
}

// ── Types ─────────────────────────────────────────────────
export type SelcomResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

// ── Mobile Money STK Push ─────────────────────────────────
export async function initiateStkPush({
  order_id, msisdn, amount, webhook_url, provider = 'mpesa',
}: {
  order_id: string
  msisdn: string        // 255712345678
  amount: number
  webhook_url: string
  provider?: string
}): Promise<SelcomResult<{ order_id: string }>> {

  if (IS_DEV) {
    console.warn(`[Selcom] DEV mode — simulating STK Push (${provider})`)
    return { ok: true, order_id }
  }

  const body = JSON.stringify({
    vendor:        VENDOR_ID,
    order_id,
    buyer_msisdn:  msisdn,
    amount,
    currency:      'TZS',
    webhook:       webhook_url,
    payment_method: PROVIDER_MAP[provider] ?? 'MPESA',
    billing_type:  'FORCE-MSISDN',
    no_of_items:   1,
  })

  try {
    const res  = await fetch(`${API_BASE}/checkout/create-order-minimal-c2b`, {
      method: 'POST',
      headers: selcomHeaders(body),
      body,
    })
    const data = await res.json()

    if (data.resultcode === '000' || data.result === 'SUCCESS') {
      return { ok: true, order_id }
    }
    return { ok: false, error: data.message ?? 'Selcom ilikataa ombi' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Selcom API error' }
  }
}

// ── Card Payment (Mastercard / Visa) ─────────────────────
export async function initiateCardPayment({
  order_id, amount, webhook_url, buyer_email, buyer_name,
}: {
  order_id: string
  amount: number
  webhook_url: string
  buyer_email: string
  buyer_name: string
}): Promise<SelcomResult<{ order_id: string; payment_url: string }>> {

  if (IS_DEV) {
    console.warn('[Selcom] DEV mode — simulating Card Payment')
    return { ok: true, order_id, payment_url: '' }
  }

  const body = JSON.stringify({
    vendor:        VENDOR_ID,
    order_id,
    amount,
    currency:      'TZS',
    buyer_email,
    buyer_name,
    webhook:       webhook_url,
    payment_method: 'CARD',
    no_of_items:   1,
  })

  try {
    const res  = await fetch(`${API_BASE}/checkout/create-order-minimal-checkout`, {
      method: 'POST',
      headers: selcomHeaders(body),
      body,
    })
    const data = await res.json()

    if (data.resultcode === '000' || data.result === 'SUCCESS') {
      return { ok: true, order_id, payment_url: data.payment_url ?? data.data?.payment_url ?? '' }
    }
    return { ok: false, error: data.message ?? 'Selcom card payment ilikataa' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Selcom API error' }
  }
}

// ── Webhook signature verification ───────────────────────
export function verifyWebhookSignature(
  body: string,
  receivedDigest: string,
  ts: string
): boolean {
  if (!API_SECRET) return true // dev mode — accept all
  const expected = sign(body, ts)
  const expectedBuf = Buffer.from(expected)
  const receivedBuf = Buffer.from(receivedDigest)
  // timingSafeEqual throws on length mismatch — guard so a malformed digest
  // rejects cleanly instead of throwing.
  if (expectedBuf.length !== receivedBuf.length) return false
  return crypto.timingSafeEqual(expectedBuf, receivedBuf)
}
