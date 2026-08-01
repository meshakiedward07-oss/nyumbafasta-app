import { NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'

// Checks Resend API key + domain verification status
// GET /api/v1/admin/email/diagnose
export async function GET() {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const key = process.env.RESEND_API_KEY

  if (!key) {
    return NextResponse.json({
      ok: false,
      error: 'RESEND_API_KEY haijawekwa kwenye Vercel environment variables',
      steps: ['Nenda Vercel Dashboard → Settings → Environment Variables', 'Ongeza RESEND_API_KEY na value yako ya Resend'],
    })
  }

  // Check API key validity + list domains
  let domainsData: Record<string, unknown>[] = []
  let apiKeyValid = false
  let apiError: string | null = null

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (res.status === 401) {
      apiError = 'API key si sahihi (401 Unauthorized) — angalia value ya RESEND_API_KEY'
    } else if (!res.ok) {
      apiError = `Resend API ilirudisha ${res.status}`
    } else {
      const body = await res.json() as { data?: Record<string, unknown>[] }
      domainsData = body.data ?? []
      apiKeyValid = true
    }
  } catch (e) {
    apiError = `Imeshindwa kuwasiliana na Resend API: ${e instanceof Error ? e.message : String(e)}`
  }

  // Check inbound env var
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN ?? null

  // Find nyumbafasta.co domain
  const ourDomain = domainsData.find(d =>
    String(d.name ?? '').includes('nyumbafasta') || String(d.name ?? '').includes('nyumbafasta.co'),
  ) ?? null

  const domainStatus = ourDomain
    ? String(ourDomain.status ?? 'unknown')
    : 'not_found'

  const records = (ourDomain?.records as Record<string, unknown>[] | null) ?? []

  // Build what's missing
  const issues: string[] = []
  const fixes: string[] = []

  if (!apiKeyValid && apiError) {
    issues.push(apiError)
    fixes.push('Angalia RESEND_API_KEY kwenye Vercel Dashboard → Settings → Environment Variables')
  }

  if (apiKeyValid && domainStatus === 'not_found') {
    issues.push('Domain nyumbafasta.co haijaongezwa kwenye Resend')
    fixes.push('Nenda resend.com/domains → Add Domain → ingiza "nyumbafasta.co"')
    fixes.push('Ongeza DNS records wanazokuonyesha (SPF + DKIM)')
  } else if (apiKeyValid && domainStatus !== 'verified') {
    issues.push(`Domain ipo kwenye Resend lakini status ni "${domainStatus}" (si "verified")`)
    fixes.push('Angalia DNS records zako zote zimewekwa vizuri kwenye domain registrar yako')
    fixes.push('Baada ya kuweka DNS records, nenda Resend → Domains → Verify')
  }

  if (!inboundDomain) {
    issues.push('RESEND_INBOUND_DOMAIN haijawekwa — barua pepe zinazokuja hazitapanga kwenye thread')
    fixes.push('Ongeza RESEND_INBOUND_DOMAIN=nyumbafasta.co kwenye Vercel env vars')
  }

  if (apiKeyValid && domainStatus === 'verified') {
    // Inbound webhook can't be verified via API — just surface as advisory, not a blocking issue
    fixes.push('Hakikisha inbound webhook imewekwa: Resend Dashboard → Inbound → Webhook URL: https://nyumbafasta.co/api/v1/email/inbound')
    fixes.push('Hakikisha MX record ipo: nyumbafasta.co → inbound.resend.com (priority 10)')
  }

  return NextResponse.json({
    ok: issues.length === 0,
    api_key_set: !!key,
    api_key_valid: apiKeyValid,
    api_error: apiError,
    domain_status: domainStatus,
    domain_data: ourDomain,
    dns_records: records,
    inbound_domain_env: inboundDomain,
    all_resend_domains: domainsData.map(d => ({ name: d.name, status: d.status })),
    issues,
    fixes,
  })
}
