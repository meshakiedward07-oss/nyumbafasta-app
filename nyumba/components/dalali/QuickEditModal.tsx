'use client'
import { useState, useRef } from 'react'
import Image from 'next/image'
import type { Listing } from '@/lib/types/database'

async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
  const data = await res.json()
  if (!data.url) throw new Error(data.error ?? 'Upload ilishindwa')
  return data.url as string
}

interface Props {
  listing: Listing
  onClose:  () => void
  onSaved:  (updated: Partial<Listing>) => void
}

export default function QuickEditModal({ listing, onClose, onSaved }: Props) {
  const [price,    setPrice]    = useState(String(listing.price_monthly))
  const [images,   setImages]   = useState<string[]>(listing.images ?? [])
  const [saving,   setSaving]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error,    setError]    = useState('')
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set())
  const [occupancy, setOccupancy] = useState(listing.current_occupancy ?? 0)
  const fileRef = useRef<HTMLInputElement>(null)

  const isMulti = listing.listing_unit_type === 'multi'

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 10 - images.length)
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const urls = await Promise.all(files.map(uploadToCloudinary))
      setImages(prev => [...prev, ...urls])
    } catch {
      setError('Baadhi ya picha hazikupakiwa. Jaribu tena.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removeImage(i: number) {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setImgErrors(prev => { const s = new Set(prev); s.delete(i); return s })
  }

  async function handleSave() {
    setError('')
    const priceNum = parseInt(price, 10)
    if (!Number.isFinite(priceNum) || priceNum < 10000) {
      setError('Bei si sahihi — kodi ya chini kabisa ni Tsh 10,000/mwezi')
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/v1/listings/${listing.id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price_monthly: priceNum, images }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Imeshindwa kuhifadhi')

      // Update occupancy if multi-unit and value changed
      if (isMulti && occupancy !== (listing.current_occupancy ?? 0)) {
        const occRes = await fetch(`/api/v1/listings/${listing.id}/occupancy`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ occupancy }),
        })
        const occData = await occRes.json()
        if (!occRes.ok) throw new Error(occData.error ?? 'Imeshindwa kusasisha idadi')
      }

      onSaved({ price_monthly: priceNum, images, current_occupancy: occupancy })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Hitilafu imetokea')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900"><i className="ti ti-bolt" aria-hidden="true" /> Update Haraka</h2>
          <button
            onClick={onClose}
            aria-label="Funga"
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-6 space-y-5">

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Listing name */}
          <p className="text-xs text-gray-400 truncate">
            {listing.title || `${listing.type} — ${listing.district}`}
          </p>

          {/* Price */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Bei ya Kodi (Tsh / mwezi)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">Tsh</span>
              <input
                type="number"
                inputMode="numeric"
                min="1000"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>

          {/* Occupancy — multi-unit only */}
          {isMulti && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
                Wapangaji wa Sasa ({listing.total_capacity} nafasi)
              </label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setOccupancy(o => Math.max(0, o - 1))}
                  className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 font-bold text-xl flex items-center justify-center active:scale-95"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-bold text-gray-900">{occupancy}</span>
                  <span className="text-gray-400 text-sm"> / {listing.total_capacity}</span>
                </div>
                <button
                  onClick={() => setOccupancy(o => Math.min(listing.total_capacity, o + 1))}
                  className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold text-xl flex items-center justify-center active:scale-95"
                >
                  +
                </button>
              </div>
              {occupancy >= listing.total_capacity && (
                <p className="text-xs text-amber-600 mt-1.5 text-center">
                  Imejaa — listing itafungwa automatically
                </p>
              )}
            </div>
          )}

          {/* Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Picha ({images.length}/10)
              </label>
              {images.length < 10 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-primary-600 font-medium bg-primary-50 px-3 py-1 rounded-full disabled:opacity-50"
                >
                  {uploading ? 'Inapakia...' : '+ Ongeza'}
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
            />

            {images.length === 0 ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl
                           flex flex-col items-center justify-center gap-1 text-gray-400"
              >
                <i className="ti ti-camera text-2xl text-gray-400" aria-hidden="true" />
                <span className="text-xs">Bonyeza kupakia picha</span>
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {images.map((src, i) => (
                  <div key={`${src}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    {!imgErrors.has(i) ? (
                      <Image
                        fill
                        src={src}
                        alt=""
                        className="object-cover"
                        sizes="25vw"
                        unoptimized
                        onError={() => setImgErrors(prev => new Set([...prev, i]))}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl"><i className="ti ti-camera" aria-hidden="true" /></div>
                    )}
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-primary-500/80 text-white text-[9px] text-center py-0.5">
                        Kuu
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                    >
                      <i className="ti ti-x" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {images.length < 10 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square rounded-xl border-2 border-dashed border-gray-200
                               flex items-center justify-center text-2xl text-gray-300 disabled:opacity-50"
                  >
                    {uploading ? (
                      <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : '+'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save button — sticky bottom */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4">
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-50 active:scale-95 transition-all"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Inahifadhi...
              </span>
            ) : 'Hifadhi Mabadiliko'}
          </button>
        </div>
      </div>
    </div>
  )
}
