'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { ListingWithDalali } from '@/lib/types/database'
import BottomNav from '@/components/shared/BottomNav'

type SavedItem = { savedId: string; listing: ListingWithDalali }

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

function formatPrice(n: number) {
  if (n >= 1_000_000) return `Tsh ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `Tsh ${(n / 1_000).toFixed(0)}k`
  return `Tsh ${n}`
}

export default function SavedClient({ saved: initial, role = 'client' }: { saved: SavedItem[]; role?: string }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [removing, setRemoving] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null)

  async function handleUnsave(listingId: string) {
    setRemoving(listingId)
    try {
      await fetch(`/api/v1/saved/${listingId}`, { method: 'DELETE' })
      setItems(prev => prev.filter(i => i.listing.id !== listingId))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-primary-500 px-4 pt-5 pb-5 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            aria-label="Rudi nyuma"
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 text-white"
          >
            ←
          </button>
          <div>
            <h1 className="text-white text-lg font-bold">Zilizohifadhiwa</h1>
            <p className="text-green-100 text-xs">{items.length} listing{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 flex justify-center"><i className="ti ti-heart text-gray-300 text-6xl" aria-hidden="true" /></div>
            <p className="text-gray-600 font-semibold mb-1">Bado hujahifadhi listings</p>
            <p className="text-gray-400 text-sm mb-6">Bonyeza kwenye listing yoyote kuihifadhi hapa</p>
            <Link
              href="/"
              className="bg-primary-500 text-white px-6 py-3 rounded-2xl text-sm font-semibold"
            >
              Tafuta Listings →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(({ listing }) => {
              const profile = listing.dalali?.dalali_profiles
              return (
                <div key={listing.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  listing.status === 'taken' ? 'border-amber-100' : 'border-gray-100'
                }`}>
                  {listing.status === 'taken' && (
                    <div className="bg-amber-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-700 flex items-center gap-1"><i className="ti ti-circle-dot text-red-500" aria-hidden="true" />Nyumba hii imeshapangishwa</span>
                      <Link href={`/?region=${listing.region}`}
                        className="text-xs text-primary-600 font-medium underline">
                        Tafuta nyingine →
                      </Link>
                    </div>
                  )}
                  <Link href={`/listings/${listing.id}`} className={`block ${listing.status === 'taken' ? 'opacity-60' : ''}`}>
                    <div className="relative h-40 bg-gray-100">
                      {listing.images?.[0] ? (
                        <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="100vw" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl"><i className="ti ti-home" aria-hidden="true" /></div>
                      )}
                      {listing.is_boosted && listing.status !== 'taken' && (
                        <div className="absolute top-2 left-2 bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                          <i className="ti ti-bolt" aria-hidden="true" /> Boosted
                        </div>
                      )}
                      <div className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                        listing.status === 'active'
                          ? 'bg-primary-50 text-primary-700'
                          : listing.status === 'taken'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {listing.status === 'active' ? 'Inapatikana' : listing.status === 'taken' ? 'Imepangishwa' : listing.status}
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">
                          {typeLabel[listing.type] || listing.type} – {listing.district}
                        </p>
                        <p className="text-primary-600 font-bold text-sm whitespace-nowrap">
                          {formatPrice(listing.price_monthly)}/mwezi
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><i className="ti ti-map-pin" aria-hidden="true" />{listing.district}, {listing.region}</p>
                      {profile && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold">
                            {listing.dalali?.full_name?.[0] ?? 'D'}
                          </div>
                          <span className="text-xs text-gray-500">{listing.dalali?.full_name}</span>
                          {profile.is_premium_verified && <i className="ti ti-circle-check text-primary-500 text-xs" aria-hidden="true" />}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Unsave action */}
                  <div className="border-t border-gray-50 px-3 py-2 flex justify-end items-center gap-2">
                    {confirmingRemove === listing.id ? (
                      <>
                        <span className="text-xs text-gray-500">Una uhakika?</span>
                        <button
                          onClick={() => { handleUnsave(listing.id); setConfirmingRemove(null) }}
                          disabled={removing === listing.id}
                          className="text-xs text-white bg-red-500 px-4 py-2.5 min-h-[44px] rounded-xl font-medium disabled:opacity-50 flex items-center"
                        >
                          {removing === listing.id ? '...' : 'Ondoa'}
                        </button>
                        <button
                          onClick={() => setConfirmingRemove(null)}
                          className="text-xs text-gray-400 px-3 py-2.5 min-h-[44px] flex items-center"
                        >
                          Ghairi
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmingRemove(listing.id)}
                        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors min-h-[44px] px-2"
                      >
                        <i className="ti ti-trash" aria-hidden="true" />
                        Ondoa
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <BottomNav role={role} />
    </div>
  )
}
