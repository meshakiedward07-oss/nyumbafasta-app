'use client'
import type { ReactNode } from 'react'

// Google Maps removed — this is now a no-op wrapper kept for import compatibility.
// Map components (SingleListingMap, MapView, ListingLocationPicker) use Leaflet directly.
export const GOOGLE_MAP_ID = '' // unused

export function MapProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}
