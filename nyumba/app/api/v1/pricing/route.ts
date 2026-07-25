import { NextResponse } from 'next/server'
import { getPricing } from '@/lib/config/pricing'

// Public endpoint — client components call this to get live prices
// Cache at CDN edge for 5 minutes; revalidate on admin update via Cache-Control
export const revalidate = 300

export async function GET() {
  try {
    const pricing = await getPricing()
    return NextResponse.json(pricing, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET app/api/v1/pricing]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
