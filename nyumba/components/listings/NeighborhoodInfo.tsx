'use client'
import { useEffect, useState } from 'react'

interface NearbyPlace {
  name:     string
  distance: number
  rating?:  number
}

interface NeighborhoodData {
  schools:        NearbyPlace[]
  hospitals:      NearbyPlace[]
  markets:        NearbyPlace[]
  transport:      NearbyPlace[]
  banks:          NearbyPlace[]
  cbdDistanceKm:  number
  cbdDurationMin: number
  cbdLabel:       string
}

const CATEGORIES: {
  key:   keyof Pick<NeighborhoodData, 'schools' | 'hospitals' | 'markets' | 'transport' | 'banks'>
  label: string
  icon: string
}[] = [
  { key: 'schools',   label: 'Shule',     icon: 'school' },
  { key: 'hospitals', label: 'Hospitali', icon: 'building-hospital' },
  { key: 'markets',   label: 'Masoko',    icon: 'shopping-cart' },
  { key: 'transport', label: 'Usafiri',   icon: 'bus' },
  { key: 'banks',     label: 'Benki',     icon: 'building-bank' },
]

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
      <div className="h-5 w-40 bg-gray-200 rounded mb-1" />
      <div className="h-3 w-56 bg-gray-100 rounded mb-4" />
      <div className="h-16 bg-green-50 rounded-xl mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function NeighborhoodInfo({ listingId }: { listingId: string }) {
  const [data, setData]       = useState<NeighborhoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/listings/${listingId}/neighborhood`)
      .then(res => {
        if (!res.ok) throw new Error('no-data')
        return res.json() as Promise<NeighborhoodData>
      })
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [listingId])

  if (loading) return <Skeleton />

  if (error || !data) {
    return (
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5"><i className="ti ti-map-pin" aria-hidden="true" /> Habari za Mtaa</h3>
        <p className="text-xs text-gray-400">
          Taarifa za mtaa hazikupatikana kwa sasa. Jaribu tena baadaye.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-700 mb-0.5 flex items-center gap-1.5"><i className="ti ti-map-pin" aria-hidden="true" /> Habari za Mtaa
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Vitu vilivyo karibu na nyumba hii
      </p>

      {/* CBD distance */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 mb-4 flex items-center gap-3">
        <i className="ti ti-building-skyscraper text-2xl flex-shrink-0 text-primary-500" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-primary-800">
            Umbali kutoka {data.cbdLabel}
          </p>
          <p className="text-xs text-primary-600">
            {data.cbdDistanceKm} km
            {data.cbdDurationMin > 0 && (
              <span> · dakika {data.cbdDurationMin} kwa gari</span>
            )}
          </p>
        </div>
      </div>

      {/* Category grid */}
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(cat => {
          const items = data[cat.key] as NearbyPlace[]
          return (
            <div key={cat.key} className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <i className={`ti ti-${cat.icon} text-base leading-none`} aria-hidden="true" />
                <span className="text-xs font-semibold text-gray-700">{cat.label}</span>
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Hakuna {cat.label.toLowerCase()} karibu
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {items.slice(0, 3).map((place, i) => (
                    <li key={i} className="flex justify-between items-start gap-1 text-xs">
                      <span className="text-gray-600 line-clamp-1 flex-1">{place.name}</span>
                      <span className="text-gray-400 font-medium whitespace-nowrap flex-shrink-0">
                        {place.distance} km
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        * Umbali kutoka eneo la nyumba — taarifa kutoka OpenStreetMap
      </p>
    </section>
  )
}
