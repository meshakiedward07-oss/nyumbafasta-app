export interface LocationFields {
  location_display?: string | null
  region?: string | null
  district?: string | null
  ward?: string | null
  mtaa?: string | null
  street?: string | null
}

export function getFullLocation(listing: LocationFields): string {
  if (listing.location_display) return listing.location_display
  const parts = [
    listing.street,
    listing.mtaa,
    listing.ward,
    listing.district,
    listing.region,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : 'Mahali haijabainishwa'
}

export function getShortLocation(listing: LocationFields): string {
  const parts = [listing.mtaa, listing.district].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : getFullLocation(listing)
}
