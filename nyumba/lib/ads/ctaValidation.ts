import { normalizePhone } from '@/lib/utils/phone'

/**
 * Validates/normalizes a campaign's cta_value against its cta_type before it
 * is ever stored or rendered. Found via ads-system audit 2026-09-01: neither
 * POST /api/v1/advertising/campaigns nor PATCH .../campaigns/[id] validated
 * cta_value at all for cta_type === 'website' — an advertiser could set it to
 * `javascript:...` (or any other scheme) and it was rendered verbatim as
 * `<a href={ad.cta_value}>` in every ad component (BannerAd, SearchAd,
 * NearbyAds, VideoAdCard, FeaturedCard, RankedAdSlot). This app's CSP
 * (next.config.mjs) includes 'unsafe-inline' on script-src — required for
 * Next.js hydration — which does not block javascript: URI execution on
 * click, so this was a real stored-XSS vector against any visitor who
 * clicked an approved ad's "Tembelea Tovuti" button.
 */
export function validateCtaValue(
  ctaType: string,
  rawValue: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (ctaType === 'whatsapp' || ctaType === 'call') {
    const normalized = normalizePhone(rawValue)
    if (!normalized) return { ok: false, error: 'Namba ya simu si sahihi' }
    return { ok: true, value: normalized }
  }

  if (ctaType === 'website') {
    let url: URL
    try {
      url = new URL(rawValue)
    } catch {
      return { ok: false, error: 'Anwani ya tovuti si sahihi' }
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, error: 'Tovuti lazima ianze na http:// au https://' }
    }
    return { ok: true, value: url.toString() }
  }

  // Unknown cta_type — reject rather than silently store an unvalidated value
  return { ok: false, error: 'Aina ya kitufe (cta_type) si sahihi' }
}
