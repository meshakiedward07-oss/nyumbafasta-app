'use client'
import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

const MAP_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

// Real Map ID from Google Cloud Console (Maps → Map management).
// Falls back to DEMO_MAP_ID so AdvancedMarker works even before a real ID is configured.
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? 'DEMO_MAP_ID'

export function MapProvider({ children }: { children: ReactNode }) {
  if (!MAP_API_KEY) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-xl text-sm text-gray-400 p-6 w-full h-full">
        Ramani hazipatikani — weka NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    )
  }
  return (
    <APIProvider
      apiKey={MAP_API_KEY}
      version="weekly"
      region="TZ"
      language="sw"
    >
      {children}
    </APIProvider>
  )
}
