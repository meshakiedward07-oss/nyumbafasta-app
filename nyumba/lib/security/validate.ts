// Lightweight, dependency-free validation helpers.
// (zod is intentionally NOT a project dependency — these mirror the schemas we need
// without adding a package.)

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: string[] }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const LISTING_TYPES = ['chumba', 'apartment', 'nyumba', 'studio', 'duka'] as const
const FURNISHED_VALUES = ['empty', 'semi', 'full'] as const

export interface ListingInput {
  type: (typeof LISTING_TYPES)[number]
  price_monthly: number
  region: string
  district: string
  description: string | null
  bedrooms: number | null
  furnished: string
  amenities: string[]
  images: string[]
  video_url: string | null
  latitude: number | null
  longitude: number | null
  // Shop-specific (optional)
  shop_size_sqm: number | null
  floor_level: number | null
  commercial_use: string | null
}

export function validateListing(body: unknown): ValidationResult<ListingInput> {
  const errors: string[] = []
  if (!isObject(body)) return { ok: false, errors: ['Taarifa si sahihi'] }

  const type = body.type
  if (typeof type !== 'string' || !LISTING_TYPES.includes(type as never)) {
    errors.push('Aina ya listing si sahihi')
  }

  const price = Number(body.price_monthly)
  if (!Number.isFinite(price) || price < 1000 || price > 100_000_000) {
    errors.push('Bei si sahihi (1,000 – 100,000,000)')
  }

  const region = typeof body.region === 'string' ? body.region.trim() : ''
  if (region.length < 2 || region.length > 100) errors.push('Mkoa si sahihi')

  const district = typeof body.district === 'string' ? body.district.trim() : ''
  if (district.length < 2 || district.length > 100) errors.push('Wilaya si sahihi')

  let description: string | null = null
  if (body.description != null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      errors.push('Maelezo ni marefu sana (max 2000)')
    } else {
      description = body.description.trim() || null
    }
  }

  let bedrooms: number | null = null
  if (body.bedrooms != null) {
    const b = Number(body.bedrooms)
    if (!Number.isInteger(b) || b < 0 || b > 20) errors.push('Idadi ya vyumba si sahihi')
    else bedrooms = b
  }

  let furnished = 'empty'
  if (body.furnished != null) {
    if (typeof body.furnished !== 'string' || !FURNISHED_VALUES.includes(body.furnished as never)) {
      errors.push('Furnished si sahihi')
    } else {
      furnished = body.furnished
    }
  }

  let amenities: string[] = []
  if (body.amenities != null) {
    if (
      !Array.isArray(body.amenities) ||
      body.amenities.length > 30 ||
      !body.amenities.every((a) => typeof a === 'string' && a.length <= 50)
    ) {
      errors.push('Amenities si sahihi')
    } else {
      amenities = body.amenities as string[]
    }
  }

  let images: string[] = []
  if (body.images != null) {
    if (
      !Array.isArray(body.images) ||
      body.images.length > 10 ||
      !body.images.every((u) => typeof u === 'string' && isHttpUrl(u))
    ) {
      errors.push('Picha si sahihi')
    } else {
      images = body.images as string[]
    }
  }

  let video_url: string | null = null
  if (body.video_url != null && body.video_url !== '') {
    if (typeof body.video_url !== 'string' || !isHttpUrl(body.video_url)) {
      errors.push('Video URL si sahihi')
    } else {
      video_url = body.video_url
    }
  }

  const latitude = typeof body.latitude === 'number' ? body.latitude : null
  const longitude = typeof body.longitude === 'number' ? body.longitude : null

  // Shop fields — optional, validated loosely
  let shop_size_sqm: number | null = null
  if (body.shop_size_sqm != null) {
    const s = Number(body.shop_size_sqm)
    if (Number.isFinite(s) && s >= 0 && s <= 50000) shop_size_sqm = s
  }
  let floor_level: number | null = null
  if (body.floor_level != null) {
    const fl = Number(body.floor_level)
    if (Number.isInteger(fl) && fl >= 0 && fl <= 100) floor_level = fl
  }
  const commercial_use = typeof body.commercial_use === 'string' && body.commercial_use.length <= 50
    ? body.commercial_use.trim() || null
    : null

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    data: {
      type: type as ListingInput['type'],
      price_monthly: price,
      region,
      district,
      description,
      bedrooms,
      furnished,
      amenities,
      images,
      video_url,
      latitude,
      longitude,
      shop_size_sqm,
      floor_level,
      commercial_use,
    },
  }
}

export interface ProfileInput {
  full_name?: string
  bio?: string | null
  whatsapp_number?: string
  avatar_url?: string
}

export function validateProfile(body: unknown): ValidationResult<ProfileInput> {
  const errors: string[] = []
  if (!isObject(body)) return { ok: false, errors: ['Taarifa si sahihi'] }
  const out: ProfileInput = {}

  if (body.full_name != null) {
    const v = String(body.full_name).trim()
    if (v.length < 2 || v.length > 100) errors.push('Jina si sahihi')
    else out.full_name = v
  }

  if (body.bio != null) {
    const v = String(body.bio).trim()
    if (v.length > 500) errors.push('Bio ni ndefu sana (max 500)')
    else out.bio = v || null
  }

  if (body.whatsapp_number != null) {
    const v = String(body.whatsapp_number).trim()
    if (v !== '' && !/^\+?[0-9]{9,15}$/.test(v)) errors.push('Namba ya WhatsApp si sahihi')
    else out.whatsapp_number = v
  }

  if (body.avatar_url != null) {
    const v = String(body.avatar_url)
    if (v !== '' && !isHttpUrl(v)) errors.push('Avatar URL si sahihi')
    else out.avatar_url = v
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, data: out }
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
