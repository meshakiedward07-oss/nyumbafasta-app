// AzamPay Tanzania payment gateway integration

// ── Startup config validation — fail loudly if any credential is missing ──────
const _cfg = {
  appName:      process.env.AZAMPAY_APP_NAME,
  clientId:     process.env.AZAMPAY_CLIENT_ID,
  clientSecret: process.env.AZAMPAY_CLIENT_SECRET,
  apiKey:       process.env.AZAMPAY_API_KEY,
  environment:  process.env.AZAMPAY_ENVIRONMENT ?? 'sandbox',
}
const _missing = (Object.entries(_cfg) as [string, string | undefined][])
  .filter(([k, v]) => k !== 'environment' && !v)
  .map(([k]) => k)
if (_missing.length > 0) {
  throw new Error(`[AzamPay] Config missing: ${_missing.join(', ')}`)
}

const IS_SANDBOX = _cfg.environment !== 'production'

const AUTH_URL = IS_SANDBOX
  ? 'https://authenticator-sandbox.azampay.co.tz'
  : 'https://authenticator.azampay.co.tz'

const CHECKOUT_BASE = IS_SANDBOX
  ? 'https://sandbox.azampay.co.tz'
  : 'https://checkout.azampay.co.tz'

// Verified working path — sandbox returns HTTP 200, closes connection without body
const CHECKOUT_URL = `${CHECKOUT_BASE}/api/v1/Partner/PostMobileCheckout`

export type MobileProvider = 'Mpesa' | 'AirtelMoney' | 'Tigopesa' | 'Halopesa'

// Token cache — valid ~55 min to avoid re-fetching on every request
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    console.log('[AzamPay] Auth token kutoka cache (inaisha:', new Date(tokenExpiresAt).toISOString(), ')')
    return cachedToken
  }

  console.log('[AzamPay] Auth starting. Environment:', _cfg.environment)
  console.log('[AzamPay] Credentials present:', !!_cfg.clientId, !!_cfg.clientSecret)

  const clientId     = _cfg.clientId!
  const clientSecret = _cfg.clientSecret!
  const appName      = _cfg.appName ?? 'NyumbaFasta'

  console.log('[AzamPay] Auth request body:', {
    appName,
    clientId:     `${clientId.slice(0, 8)}... (SET)`,
    clientSecret: `len=${clientSecret.length} (SET)`,
  })

  const authUrl = `${AUTH_URL}/AppRegistration/GenerateToken`
  console.log('[AzamPay] Auth URL:', authUrl)

  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appName, clientId, clientSecret }),
  })

  console.log('[AzamPay] Auth response status:', res.status, res.statusText)

  const rawText = await res.text()
  console.log('[AzamPay] Auth response body:', rawText.slice(0, 500))

  if (!res.ok) {
    console.error('[AzamPay] Token request FAILED:', res.status, rawText)
    throw new Error(`AzamPay auth imeshindwa: ${res.status} ${rawText}`)
  }

  let data: Record<string, unknown>
  try { data = JSON.parse(rawText) } catch {
    throw new Error(`AzamPay auth: jibu si JSON validi: ${rawText.slice(0, 200)}`)
  }

  const token = (data?.data as Record<string, unknown>)?.accessToken as string ?? data?.accessToken as string
  if (!token) {
    console.error('[AzamPay] Token request FAILED: hakuna accessToken katika jibu:', data)
    throw new Error('AzamPay: hakuna token katika jibu la auth')
  }

  console.log('[AzamPay] Token received successfully ✓ inaisha:', (data?.data as Record<string, unknown>)?.expire ?? 'unknown')

  cachedToken = token
  tokenExpiresAt = Date.now() + 55 * 60 * 1000
  return token
}

export interface MobileCheckoutParams {
  accountNumber: string   // 255XXXXXXXXX
  amount: number
  currency?: string
  externalId: string
  provider: MobileProvider
  callbackUrl?: string
}

export interface AzamPayResult {
  ok: boolean
  transactionId?: string
  message: string
  raw?: unknown
}

export async function mobileCheckout(params: MobileCheckoutParams): Promise<AzamPayResult> {
  try {
    console.log('[AzamPay] Starting mobileCheckout...')

    const token = await getAuthToken()

    const checkoutPayload = {
      accountNumber: params.accountNumber,
      amount:        String(params.amount),
      currency:      params.currency ?? 'TZS',
      externalId:    params.externalId,
      provider:      params.provider,
      ...(params.callbackUrl ? { callbackUrl: params.callbackUrl } : {}),
    }

    console.log('[AzamPay] Checkout payload:', {
      ...checkoutPayload,
      accountNumber: params.accountNumber.slice(0, 6) + '...',  // mask last 6 digits
    })
    console.log('[AzamPay] Checkout URL:', CHECKOUT_URL)

    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        'X-API-KEY':    _cfg.apiKey!,
      },
      body: JSON.stringify(checkoutPayload),
    })

    console.log('[AzamPay] Checkout response status:', res.status, res.statusText)

    // Sandbox returns HTTP 200 and immediately closes connection (ECONNRESET on body)
    // Any 2xx = request accepted; body parse failure is normal
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
      let rawBody = ''
      try {
        rawBody = await res.text()
        if (rawBody) data = JSON.parse(rawBody)
      } catch { /* empty body or parse error is normal for this gateway */ }

      console.log('[AzamPay] Checkout response body:', rawBody.slice(0, 300) || '(empty — normal for sandbox)')

      if (data?.success === false) {
        console.error('[AzamPay] Checkout rejected by gateway:', data)
        return { ok: false, message: String(data.message ?? 'AzamPay ilikataa ombi'), raw: data }
      }

      console.log('[AzamPay] Checkout accepted ✓ externalId:', params.externalId)
      return {
        ok:            true,
        transactionId: String(data?.transactionId ?? data?.data?.transactionId ?? params.externalId),
        message:       String(data?.message ?? 'Ombi limetumwa. Angalia simu yako.'),
        raw:           data,
      }
    }

    let rawErr = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errData: any = {}
    try {
      rawErr = await res.text()
      if (rawErr) errData = JSON.parse(rawErr)
    } catch { /* ignore */ }
    console.error('[AzamPay] Checkout FAILED:', res.status, rawErr.slice(0, 300))
    return {
      ok:      false,
      message: String(errData?.message ?? `AzamPay ilikataa: ${res.status}`),
      raw:     errData,
    }
  } catch (e) {
    console.error('[AzamPay] mobileCheckout exception:', e)
    return { ok: false, message: String(e) }
  }
}

export interface WebhookPayload {
  transactionstatus:  string
  operator?:          string
  reference?:         string
  externalreference?: string
  amount?:            string
  transid?:           string
  msisdn?:            string
}

export function isWebhookSuccess(payload: WebhookPayload): boolean {
  const status = (payload.transactionstatus ?? '').toLowerCase()
  return status === 'success' || status === 'successful'
}

export function getExternalId(payload: WebhookPayload): string {
  return payload.externalreference ?? payload.reference ?? ''
}

// ── Tanzania phone number utilities ─────────────────────────────────────────

// Normalize to 255XXXXXXXXX format
export function normalizePhone(phone: string): string {
  const p = phone.trim()
  if (p.startsWith('+'))   return p.slice(1)
  if (p.startsWith('0'))   return `255${p.slice(1)}`
  if (p.startsWith('255')) return p
  return `255${p}`
}

// Detect mobile network from Tanzania phone prefix
export function detectProvider(phone: string): MobileProvider {
  const normalized = normalizePhone(phone)
  const prefix = normalized.slice(3, 6)  // e.g. "255744..." → "744"

  // Vodacom M-Pesa: 074x, 075x, 076x
  const MPESA    = ['740','741','742','743','744','745','746','747','748','749',
                    '750','751','752','753','754','755','756','757','758','759',
                    '760','761','762','763','764','765','766','767','768','769']

  // Airtel Money: 078x
  const AIRTEL   = ['780','781','782','783','784','785','786','787','788','789']

  // MiXx by YAS / Tigopesa: 065x, 071x
  const TIGOPESA = ['650','651','652','653','654','655','656','657','658','659',
                    '710','711','712','713','714','715','716','717','718','719']

  // Halopesa (TTCL): 061x, 062x
  const HALOPESA = ['610','611','612','613','614','615','616','617','618','619',
                    '621','622','623','624','625','626','627','628','629']

  if (MPESA.includes(prefix))    return 'Mpesa'
  if (AIRTEL.includes(prefix))   return 'AirtelMoney'
  if (TIGOPESA.includes(prefix)) return 'Tigopesa'
  if (HALOPESA.includes(prefix)) return 'Halopesa'

  return 'Mpesa'
}

export function generateExternalId(prefix = 'NYF'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function formatTZS(amount: number): string {
  return `TZS ${amount.toLocaleString('en-TZ')}`
}

// Builds a callback URL with an embedded secret so webhooks can be authenticated.
// Usage: buildCallbackUrl(req.nextUrl.origin, '/api/v1/payments/subscription/webhook')
export function buildCallbackUrl(origin: string, path: string): string {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) throw new Error('WEBHOOK_SECRET haipo kwenye mazingira')
  return `${process.env.NEXT_PUBLIC_APP_URL ?? origin}${path}?whsec=${encodeURIComponent(secret)}`
}

// Call this at the top of every webhook handler to reject unauthenticated requests.
export function verifyWebhookSecret(req: { nextUrl: { searchParams: { get: (k: string) => string | null } } }): boolean {
  const expected = process.env.WEBHOOK_SECRET
  const received = req.nextUrl.searchParams.get('whsec')
  return !!expected && received === expected
}
