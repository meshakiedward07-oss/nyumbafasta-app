import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getListingAnalytics } from '@/lib/listings/analytics'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    // Verify ownership (or admin)
    const admin = createAdminClient()
    const { data: listing } = await admin
      .from('listings')
      .select('dalali_id')
      .eq('id', params.id)
      .maybeSingle()

    if (!listing) {
      return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    }

    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    if (!isAdmin && listing.dalali_id !== user.id) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const data = await getListingAnalytics(params.id)
    return NextResponse.json(data)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Analytics API]', msg)
    return NextResponse.json({ error: 'Imeshindwa kupata takwimu' }, { status: 500 })
  }
}
