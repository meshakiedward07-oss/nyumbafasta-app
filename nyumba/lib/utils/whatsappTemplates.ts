const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

type ListingContactMessage = {
  dalaliName: string
  listingTitle: string
  listingLocation: string
  listingPrice: number
  listingId: string
  bedrooms?: number | null
}

export function buildContactWhatsAppMessage({
  dalaliName,
  listingTitle,
  listingLocation,
  listingPrice,
  listingId,
  bedrooms,
}: ListingContactMessage): string {
  const bedroomLine = bedrooms ? `\n🛏️ Vyumba ${bedrooms}` : ''
  return (
    `Habari ${dalaliName}! 👋\n\n` +
    `Nimefungua mawasiliano yako kwenye NyumbaFasta na ninapenda kujua zaidi kuhusu:\n\n` +
    `🏠 *${listingTitle}*\n` +
    `📍 ${listingLocation}${bedroomLine}\n` +
    `💰 TZS ${listingPrice.toLocaleString()}/mwezi\n\n` +
    `🔗 ${APP_URL}/listings/${listingId}\n\n` +
    `Je, nyumba hii bado inapatikana? Ningependa kuitembelea.`
  )
}
