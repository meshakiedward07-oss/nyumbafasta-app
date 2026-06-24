'use client'
import { APIProvider } from '@vis.gl/react-google-maps'
import type { ReactNode } from 'react'

const MAP_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

export function MapProvider({ children }: { children: ReactNode }) {
  if (!MAP_API_KEY) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-xl text-sm text-gray-400 p-6 w-full h-full">
        🗺️ Ramani hazipatikani — weka NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </div>
    )
  }
  return <APIProvider apiKey={MAP_API_KEY}>{children}</APIProvider>
}
