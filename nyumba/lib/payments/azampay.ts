// AzamPay Tanzania payment gateway integration

// ── Lazy config — evaluated at call time, not module load time ────────────────
// Module-level throws break Next.js build ("collect page data" step) when vars
// aren't set in the build environment (only present at runtime).
interface AzamConfig {
  appName:      string
  clientId:     string
  clientSecret: string
  apiKey:       string
  environment:  string
}

function getConfig(): AzamConfig {
  const appName      = process.env.AZAMPAY_APP_NAME
  const clientId     = process.env.AZAMPAY_CLIENT_ID
  const clientSecret = process.env.AZAMPAY_CLIENT_SECRET
  const apiKey       = process.env.AZAMPAY_API_KEY
  const environment  = process.env.AZAMPAY_ENVIRONMENT ?? 'sandbox'

  const missing: string[] = []
  if (!appName)      missing.push('appName')
  if (!clientId)     missing.push('clientId')
  if (!clientSecret) missing.push('clientSecret')
  if (!apiKey)       missing.push('apiKey')
  if (missing.length > 0) {
    throw new Error(`[AzamPay] Config missing: ${missing.join(', ')}`)
  }

  return { appName: appName!, clientId: clientId!, clientSecret: clientSecret!, apiKey: apiKey!, environment }
}

export type MobileProvider = 'Mpesa' | 'AirtelMoney' | 'Tigopesa' | 'Halopesa'

// Token cache — valid ~55 min to avoid re-fetching on every request
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const cfg = getConfig()
  const IS_SANDBOX = cfg.environment !== 'production'
  const AUTH_URL = IS_SANDBOX
    ? 'https://authenticator-sandbox.azampay.co.tz'
    : 'https://authenticator.azampay.co.tz'

  const clientId     = cfg.clientId
  const clientSecret = cfg.clientSecret
  const appName      = cfg.appName ?? 'NyumbaFasta'

  const authUrl = `${AUTH_URL}/AppRegistration/GenerateToken`

  const res = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appName, clientId, clientSecret }),
  })

  const rawText = await res.text()

  if (!res.ok) {
    console.error('[AzamPay] Token request failed:', res.status, rawText.slice(0, 200))
    throw new Error(`AzamPay auth imeshindwa: ${res.status} ${rawText}`)
  }

  let data: Record<string, unknown>
  try { data = JSON.parse(rawText) } catch {
    throw new Error(`AzamPay auth: jibu si JSON validi: ${rawText.slice(0, 200)}`)
  }

  const token = (data?.data as Record<string, unknown>)?.accessToken as string ?? data?.accessToken as string
  if (!token) {
    console.error('[AzamPay] Token request failed: hakuna accessToken katika jibu')
    throw new Error('AzamPay: hakuna token katika jibu la auth')
  }

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
    const cfg = getConfig()
    const IS_SANDBOX = cfg.environment !== 'production'
    const CHECKOUT_BASE = IS_SANDBOX ? 'https://sandbox.azampay.co.tz' : 'https://checkout.azampay.co.tz'
    const CHECKOUT_URL = `${CHECKOUT_BASE}/api/v1/Partner/PostMobileCheckout`

    const token = await getAuthToken()

    const checkoutPayload = {
      accountNumber: params.accountNumber,
      amount:        String(params.amount),
      currency:      params.currency ?? 'TZS',
      externalId:    params.externalId,
      provider:      params.provider,
      ...(params.callbackUrl ? { callbackUrl: params.callbackUrl } : {}),
    }

    const res = await fetch(CHECKOUT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        'X-API-KEY':    cfg.apiKey,
      },
      body: JSON.stringify(checkoutPayload),
    })

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

      if (data?.success === false) {
        console.error('[AzamPay] Checkout rejected by gateway:', data)
        return { ok: false, message: String(data.message ?? 'AzamPay ilikataa ombi'), raw: data }
      }

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
    console.error('[AzamPay] Checkout failed:', res.status, rawErr.slice(0, 200))
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

// Validates webhook amount against the expected value (within 1 TZS tolerance).
// Rejects missing or unparseable amounts — never assume payment is valid without a real figure.
export function isAmountValid(payload: WebhookPayload, expectedAmount: number): boolean {
  if (!payload.amount) return false
  const received = parseFloat(payload.amount)
  if (isNaN(received)) return false
  return Math.abs(received - expectedAmount) <= 1
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
// Uses constant-time comparison to prevent timing-attack secret brute-force.
export function verifyWebhookSecret(req: { nextUrl: { searchParams: { get: (k: string) => string | null } } }): boolean {
  const expected = process.env.WEBHOOK_SECRET
  const received = req.nextUrl.searchParams.get('whsec')
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  if (a.length !== b.length) return false
  return require('crypto').timingSafeEqual(a, b)
}
