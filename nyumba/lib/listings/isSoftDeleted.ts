// A dalali "deleting" a listing is a soft delete — DELETE /api/v1/listings/[id]
// sets status='expired' AND expires_at to the Unix epoch (1970) as a
// deliberate sentinel, since 'deleted' is not a value in the DB's
// listing_status enum. A listing that expired normally (subscription
// lapsed) also has status='expired', but with a real, recent expires_at —
// so status alone can't tell the two apart. Distinguishing them matters:
// a dalali's "Listings Zangu" page is meant to still show naturally-expired
// listings (so they can renew), just not ones they explicitly deleted.
//
// Found 2026-09-01: a stale check `.filter(l => l.status !== 'deleted')`
// (present in the dashboard/listings server component) never actually
// matched anything, since no listing ever has the literal string 'deleted'
// — so deleted listings kept reappearing on the dashboard.
export function isSoftDeletedListing(status: string, expiresAt: string | null | undefined): boolean {
  if (status !== 'expired' || !expiresAt) return false
  // Safety margin, not an exact epoch-millisecond check — any real
  // subscription-expiry date is comfortably after the year 2000.
  return new Date(expiresAt).getTime() < Date.UTC(2000, 0, 1)
}
