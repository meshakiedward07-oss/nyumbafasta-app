// AzamPay Tanzania payment gateway integration
import { timingSafeEqual, createVerify } from 'crypto'

// ── Lazy config — evaluated at call time, not module load time ─────────────
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

// Provider enum must match AzamPay API exactly (see schema.Provider)
export type MobileProvider = 'Mpesa' | 'Airtel' | 'Tigo' | 'Halopesa' | 'Azampesa'

// ── Token cache ────────────────────────────────────────────────────────────
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getAuthToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken

  const cfg = getConfig()
  const IS_SANDBOX = cfg.environment !== 'production'
  const AUTH_URL = IS_SANDBOX
    ? 'https://authenticator-sandbox.azampay.co.tz'
    : 'https://authenticator.azampay.co.tz'

  let res: Response
  try {
    res = await fetch(`${AUTH_URL}/AppRegistration/GenerateToken`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ appName: cfg.appName, clientId: cfg.clientId, clientSecret: cfg.clientSecret }),
      signal:  AbortSignal.timeout(15000),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`AzamPay haipatikani: ${msg}`)
  }

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
  if (!token) throw new Error('AzamPay: hakuna token katika jibu la auth')

  cachedToken    = token
  tokenExpiresAt = Date.now() + 55 * 60 * 1000
  return token
}

// ── Public key cache for callback signature verification ───────────────────
let cachedPublicKey: string | null = null
let publicKeyFetchedAt = 0
const PUBLIC_KEY_TTL = 24 * 60 * 60 * 1000 // 24 hours

async function getAzamPayPublicKey(): Promise<string | null> {
  if (cachedPublicKey && Date.now() - publicKeyFetchedAt < PUBLIC_KEY_TTL) return cachedPublicKey
  try {
    const cfg = getConfig()
    const IS_SANDBOX = cfg.environment !== 'production'
    const base = IS_SANDBOX ? 'https://sandbox.azampay.co.tz' : 'https://checkout.azampay.co.tz'
    const token = await getAuthToken()
    const res = await fetch(`${base}/azampay/v1/public-key?format=Pem`, {
      headers: { Authorization: `Bearer ${token}`, 'X-API-KEY': cfg.apiKey },
    })
    if (!res.ok) return null
    const json = await res.json() as { success?: boolean; publicKey?: string }
    if (json.success && json.publicKey) {
      cachedPublicKey    = json.publicKey
      publicKeyFetchedAt = Date.now()
      return cachedPublicKey
    }
  } catch (e) {
    console.warn('[AzamPay] Could not fetch public key:', e)
  }
  return null
}

// ── Callback signature verification ───────────────────────────────────────
// Signed data = {utilityref}{externalreference}{transactionstatus}{operator}
// Algorithm: SHA-256 + RSA PKCS#1 v1.5
export async function verifyAzamPaySignature(payload: WebhookPayload): Promise<boolean> {
  if (!payload.signature) return true  // not signed (sandbox); allow but log
  try {
    const publicKeyPem = await getAzamPayPublicKey()
    if (!publicKeyPem) {
      console.warn('[AzamPay] No public key — skipping signature verification')
      return true
    }
    const dataToVerify = `${payload.utilityref ?? ''}${payload.externalreference ?? ''}${payload.transactionstatus ?? ''}${payload.operator ?? ''}`
    const verifier = createVerify('SHA256')
    verifier.update(dataToVerify, 'utf8')
    return verifier.verify(publicKeyPem, payload.signature, 'base64')
  } catch (e) {
    console.error('[AzamPay] Signature verification error:', e)
    return false
  }
}

export interface MobileCheckoutParams {
  accountNumber: string   // 255XXXXXXXXX
  amount:        number
  currency?:     string
  externalId:    string
  provider:      MobileProvider
  description?:  string  // shown in USSD push message to customer
}

export interface AzamPayResult {
  ok:              boolean
  transactionId?:  string
  message:         string
  raw?:            unknown
}

export async function mobileCheckout(params: MobileCheckoutParams): Promise<AzamPayResult> {
  try {
    const cfg = getConfig()
    const IS_SANDBOX  = cfg.environment !== 'production'
    // Correct MNO checkout endpoint per AzamPay OpenAPI spec
    const CHECKOUT_URL = IS_SANDBOX
      ? 'https://sandbox.azampay.co.tz/azampay/mno/checkout'
      : 'https://checkout.azampay.co.tz/azampay/mno/checkout'

    const token = await getAuthToken()

    // Fields per AzamPay CheckoutRequest schema.
    // additionalProperties lets AzamPay show merchant name in the USSD push prompt.
    const checkoutPayload = {
      accountNumber: params.accountNumber,
      amount:        params.amount,
      currency:      params.currency ?? 'TZS',
      externalId:    params.externalId,
      provider:      params.provider,
      additionalProperties: {
        productName:        'NyumbaFasta',
        productDescription: params.description ?? 'Malipo ya NyumbaFasta',
      },
    }

    const res = await fetch(CHECKOUT_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
        'X-API-KEY':    cfg.apiKey,
      },
      body:   JSON.stringify(checkoutPayload),
      signal: AbortSignal.timeout(20000),
    })

    if (res.ok) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {}
      try {
        const rawBody = await res.text()
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let errData: any = {}
    try {
      const rawErr = await res.text()
      if (rawErr) errData = JSON.parse(rawErr)
      console.error('[AzamPay] Checkout failed:', res.status, rawErr.slice(0, 200))
    } catch { /* ignore */ }

    return {
      ok:      false,
      message: String(errData?.message ?? `AzamPay ilikataa: ${res.status}`),
      raw:     errData,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isNetwork = msg.includes('haipatikani') || msg.includes('fetch') || msg.includes('abort') || msg.includes('timeout')
    console.error('[AzamPay] mobileCheckout exception:', msg)
    return {
      ok:      false,
      message: isNetwork
        ? 'Huduma ya malipo haipatikani sasa hivi. Jaribu tena baadaye.'
        : msg,
    }
  }
}

// ── Webhook payload ────────────────────────────────────────────────────────
export interface WebhookPayload {
  transactionstatus:  string
  utilityref?:        string   // our externalId (partner's reference)
  externalreference?: string   // AzamPay's reference for the transaction
  operator?:          string
  reference?:         string
  amount?:            string
  transid?:           string
  msisdn?:            string
  signature?:         string   // RSA signature (see verifyAzamPaySignature)
}

export function isWebhookSuccess(payload: WebhookPayload): boolean {
  const status = (payload.transactionstatus ?? '').toLowerCase()
  return status === 'success' || status === 'successful'
}

// Check amount within 1 TZS tolerance; reject missing/unparseable amounts.
export function isAmountValid(payload: WebhookPayload, expectedAmount: number): boolean {
  if (!payload.amount) return false
  const received = parseFloat(payload.amount)
  if (isNaN(received)) return false
  return Math.abs(received - expectedAmount) <= 1
}

// utilityref = our externalId (AzamPay's field for the partner's reference)
export function getExternalId(payload: WebhookPayload): string {
  return payload.utilityref ?? payload.externalreference ?? payload.reference ?? ''
}

// ── Tanzania phone number utilities ───────────────────────────────────────

export function normalizePhone(phone: string): string {
  const p = phone.trim()
  if (p.startsWith('+'))   return p.slice(1)
  if (p.startsWith('0'))   return `255${p.slice(1)}`
  if (p.startsWith('255')) return p
  return `255${p}`
}

// Detect MNO from Tanzania phone prefix → returns AzamPay-compatible provider value
export function detectProvider(phone: string): MobileProvider {
  const normalized = normalizePhone(phone)
  const prefix3 = normalized.slice(3, 6)  // e.g. "255744..." → "744"

  // Vodacom M-Pesa: 074x, 075x, 076x
  const MPESA_PFX = [
    '740','741','742','743','744','745','746','747','748','749',
    '750','751','752','753','754','755','756','757','758','759',
    '760','761','762','763','764','765','766','767','768','769',
  ]

  // Airtel Money: 068x, 069x, 078x
  const AIRTEL_PFX = [
    '680','681','682','683','684','685','686','687','688','689',
    '690','691','692','693','694','695','696','697','698','699',
    '780','781','782','783','784','785','786','787','788','789',
  ]

  // Tigo Pesa / MiXx: 065x, 067x, 071x
  const TIGO_PFX = [
    '650','651','652','653','654','655','656','657','658','659',
    '670','671','672','673','674','675','676','677','678','679',
    '710','711','712','713','714','715','716','717','718','719',
  ]

  // Halopesa (TTCL): 062x
  const HALO_PFX = [
    '620','621','622','623','624','625','626','627','628','629',
  ]

  if (MPESA_PFX.includes(prefix3))  return 'Mpesa'
  if (AIRTEL_PFX.includes(prefix3)) return 'Airtel'
  if (TIGO_PFX.includes(prefix3))   return 'Tigo'
  if (HALO_PFX.includes(prefix3))   return 'Halopesa'

  return 'Mpesa'  // safe default
}

export function generateExternalId(prefix = 'NYF'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export function formatTZS(amount: number): string {
  return `TZS ${amount.toLocaleString('en-TZ')}`
}

// Internal webhook authentication via URL secret (guards our endpoints from arbitrary POSTs)
export function buildCallbackUrl(origin: string, path: string): string {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) throw new Error('WEBHOOK_SECRET haipo kwenye mazingira')
  return `${process.env.NEXT_PUBLIC_APP_URL ?? origin}${path}?whsec=${encodeURIComponent(secret)}`
}

export function verifyWebhookSecret(req: { nextUrl: { searchParams: { get: (k: string) => string | null } } }): boolean {
  const expected = process.env.WEBHOOK_SECRET
  const received = req.nextUrl.searchParams.get('whsec')
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
