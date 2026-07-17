import Image from 'next/image'
import Link from 'next/link'

type FeaturedBusiness = {
  id: string; title: string; body_text: string | null; image_url: string | null
  cta_type: string; cta_value: string; target_region: string
  advertiser: {
    id: string; business_name: string; business_category: string
    logo_url: string | null; whatsapp_number: string | null
  } | null
}

export default function FeaturedCard({ ad }: { ad: FeaturedBusiness }) {
  const href = ad.cta_type === 'whatsapp' ? `https://wa.me/${ad.cta_value}`
    : ad.cta_type === 'call' ? `tel:${ad.cta_value}` : ad.cta_value

  const isExternal = ad.cta_type !== undefined

  const content = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="relative h-36 bg-gray-100">
        {ad.image_url ? (
          <Image src={ad.image_url} alt={ad.title} fill className="object-cover" sizes="(max-width: 600px) 100vw, 280px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-primary-50 to-primary-100">
            🏪
          </div>
        )}
        <div className="absolute top-2 left-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
          ⭐ Featured
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-start gap-2">
          {ad.advertiser?.logo_url && (
            <Image
              src={ad.advertiser.logo_url} alt={ad.advertiser.business_name}
              width={36} height={36} className="rounded-lg flex-shrink-0 object-cover mt-0.5"
            />
          )}
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 text-sm leading-tight">{ad.title}</h3>
            {ad.advertiser && (
              <p className="text-xs text-gray-400 truncate">{ad.advertiser.business_category}</p>
            )}
          </div>
        </div>

        {ad.body_text && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{ad.body_text}</p>
        )}

        <div className="mt-3">
          {ad.cta_type === 'whatsapp' && (
            <span className="block text-center w-full bg-green-500 text-white text-xs font-bold py-1.5 rounded-lg">
              💬 Wasiliana WhatsApp
            </span>
          )}
          {ad.cta_type === 'call' && (
            <span className="block text-center w-full bg-blue-500 text-white text-xs font-bold py-1.5 rounded-lg">
              📞 Piga Simu
            </span>
          )}
          {ad.cta_type === 'website' && (
            <span className="block text-center w-full bg-purple-500 text-white text-xs font-bold py-1.5 rounded-lg">
              🌐 Tembelea Tovuti
            </span>
          )}
        </div>
      </div>
    </div>
  )

  return isExternal ? (
    <a href={href} target={ad.cta_type === 'website' ? '_blank' : undefined} rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <Link href={href}>{content}</Link>
  )
}
