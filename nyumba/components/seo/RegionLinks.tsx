import Link from 'next/link'
import { PRIORITY_REGIONS, regionToSlug } from '@/lib/data/tanzania-locations'

// Server-rendered block of region links. Gives crawlers & AI search real,
// indexable internal links into the /mali/[region] landing pages even though
// the main home feed renders client-side.
export default function RegionLinks() {
  return (
    <section
      aria-label="Tafuta nyumba kwa mkoa"
      className="bg-white border-t border-gray-100 px-4 py-8"
    >
      <div className="max-w-5xl mx-auto">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Tafuta Nyumba kwa Mkoa
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Pata vyumba, apartments na nyumba za kupanga kwenye mikoa mikuu ya Tanzania.
        </p>
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 list-none p-0">
          {PRIORITY_REGIONS.map(region => (
            <li key={region}>
              <Link
                href={`/mali/${regionToSlug(region)}`}
                className="block text-sm bg-primary-50 text-primary-700 border border-primary-100 px-3 py-2.5 rounded-xl font-medium text-center hover:bg-primary-100 transition-colors"
              >
                Nyumba {region}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
