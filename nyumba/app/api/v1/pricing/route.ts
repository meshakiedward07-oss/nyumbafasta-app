import { NextResponse } from 'next/server'
import { getPricing } from '@/lib/config/pricing'

// Public endpoint — client components call this to get live prices
// Cache at CDN edge for 5 minutes; revalidate on admin update via Cache-Control
export const revalidate = 300

export async function GET() {
  const pricing = await getPricing()
  return NextResponse.json(pricing, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
  })
}
