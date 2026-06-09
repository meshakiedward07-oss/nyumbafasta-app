// Server component — renders JSON-LD structured data for a single property
// listing. Helps Google rich results + AI search understand the listing.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

const TYPE_LABELS: Record<string, string> = {
  chumba: 'Chumba',
  apartment: 'Apartment',
  nyumba: 'Nyumba',
  studio: 'Studio',
}

export interface PropertySchemaProps {
  id: string
  title: string
  type: string // chumba, apartment, nyumba, studio
  district: string
  region: string
  price_monthly: number
  description?: string | null
  images?: string[]
  dalaliName?: string
}

export default function PropertySchema({
  id,
  title,
  type,
  district,
  region,
  price_monthly,
  description,
  images,
  dalaliName,
}: PropertySchemaProps) {
  const typeLabel = TYPE_LABELS[type] ?? type
  const name = title || `${typeLabel} – ${district}`

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Residence',
    name,
    description:
      description ?? `${typeLabel} ya kupanga ${district}, ${region}, Tanzania.`,
    url: `${APP_URL}/listings/${id}`,
    image: images?.length ? images : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: district,
      addressRegion: region,
      addressCountry: 'TZ',
    },
    ...(dalaliName
      ? { provider: { '@type': 'RealEstateAgent', name: dalaliName } }
      : {}),
    offers: {
      '@type': 'Offer',
      price: price_monthly,
      priceCurrency: 'TZS',
      availability: 'https://schema.org/InStock',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: price_monthly,
        priceCurrency: 'TZS',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitText: 'month',
        },
      },
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
