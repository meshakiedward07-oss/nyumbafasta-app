// AzamPay Tanzania payment gateway integration
// Docs: https://developerdocs.azampay.co.tz/

const IS_SANDBOX = (process.env.AZAMPAY_ENVIRONMENT ?? 'sandbox') !== 'production'

const AUTH_URL = IS_SANDBOX
  ? 'https://authenticator-sandbox.azampay.co.tz'
  : 'https://authenticator.azampay.co.tz'

const CHECKOUT_BASE = IS_SANDBOX
  ? 'https://sandbox.azampay.co.tz'
  : 'https://checkout.azampay.co.tz'

// Verified working path (sandbox returns HTTP 200 on this path)
const CHECKOUT_URL = `${CHECKOUT_BASE}/api/v1/Partner/PostMobileCheckout`

export type MobileProvider = 'Mpesa' | 'AirtelMoney' | 'Tigopesa' | 'Halopesa'

// Cache token in module memory — valid ~1 hour
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const res = await fetch(`${AUTH_URL}/AppRegistration/GenerateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName:      process.env.AZAMPAY_APP_NAME      ?? 'NyumbaFasta',
      clientId:     process.env.AZAMPAY_CLIENT_ID     ?? '',
      clientSecret: process.env.AZAMPAY_CLIENT_SECRET ?? '',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AzamPay auth failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  // Response: { data: { accessToken: "...", expiry: "..." }, ... }
  const token = data?.data?.accessToken ?? data?.accessToken
  if (!token) throw new Error('AzamPay: no token in auth response')

  cachedToken = token
  tokenExpiresAt = Date.now() + 55 * 60 * 1000 // 55 min
  return token
}

export interface MobileCheckoutParams {
  accountNumber: string   // 255XXXXXXXXX
  amount: number
  currency?: string
  externalId: string      // our unique reference
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
    const token = await getAuthToken()

    const body = {
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
        Authorization: `Bearer ${token}`,
        'X-API-KEY':   process.env.AZAMPAY_API_KEY ?? '',
      },
      body: JSON.stringify(body),
    })

    // AzamPay sandbox returns HTTP 200 and closes the connection immediately
    // (ECONNRESET on body read is expected — treat any 2xx as accepted)
    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
      try { data = await res.json() } catch { /* empty body is normal for this gateway */ }
      if (data?.success === false) {
        return { ok: false, message: String(data.message ?? 'AzamPay ilikataa ombi'), raw: data }
      }
      return {
        ok: true,
        transactionId: String(data?.transactionId ?? data?.data?.transactionId ?? params.externalId ?? ''),
        message: String(data?.message ?? 'Ombi limetumwa. Angalia simu yako.'),
        raw: data,
      }
    }

    // Non-2xx — try to read error body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errData: any = {}
    try { errData = await res.json() } catch { /* ignore */ }
    return {
      ok: false,
      message: String(errData?.message ?? `AzamPay ilikataa: ${res.status}`),
      raw: errData,
    }
  } catch (e) {
    console.error('AzamPay mobileCheckout error:', e)
    return { ok: false, message: String(e) }
  }
}

export interface WebhookPayload {
  transactionstatus: string   // 'success' | 'SUCCESSFUL' | 'failed'
  operator?:         string
  reference?:        string   // our externalId
  externalreference?: string  // our externalId
  amount?:           string
  transid?:          string
  msisdn?:           string
}

export function isWebhookSuccess(payload: WebhookPayload): boolean {
  const status = (payload.transactionstatus ?? '').toLowerCase()
  return status === 'success' || status === 'successful'
}

export function getExternalId(payload: WebhookPayload): string {
  return payload.externalreference ?? payload.reference ?? ''
}

// Detect mobile provider from Tanzania phone prefix
export function detectProvider(phone: string): MobileProvider {
  const normalized = phone.replace(/^\+/, '').replace(/^0/, '255')
  const prefix = normalized.slice(3, 6)

  const MPESA       = ['744', '745', '746', '741', '742', '743']
  const AIRTEL      = ['783', '784', '785', '786', '787', '788', '789', '780', '781', '782']
  const TIGOPESA    = ['716', '717', '718', '719', '715']
  const HALOPESA    = ['621', '622', '623', '624', '625']

  if (MPESA.includes(prefix))    return 'Mpesa'
  if (AIRTEL.includes(prefix))   return 'AirtelMoney'
  if (TIGOPESA.includes(prefix)) return 'Tigopesa'
  if (HALOPESA.includes(prefix)) return 'Halopesa'

  return 'Mpesa' // default
}

// Normalize phone: 07XXXXXXXX → 2557XXXXXXXX, +255... → 255...
export function normalizePhone(phone: string): string {
  const p = phone.trim()
  if (p.startsWith('+'))   return p.slice(1)
  if (p.startsWith('0'))   return `255${p.slice(1)}`
  if (p.startsWith('255')) return p
  return `255${p}`
}

export function generateExternalId(prefix = 'NYF'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function formatTZS(amount: number): string {
  return `TZS ${amount.toLocaleString('en-TZ')}`
}
