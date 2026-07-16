import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Protected endpoint — returns dalali WhatsApp number ONLY after verified payment.
// Accepts two forms of access:
// 1. Direct completed unlock for this exact listing (permanent).
// 2. Any completed unlock for the same dalali within the last 24 hours.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()

  const { data: listing } = await admin
    .from('listings')
    .select('dalali_id')
    .eq('id', params.id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })

  const last24hrs = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [directUnlock, dalaliAccess] = await Promise.all([
    admin
      .from('contact_unlocks')
      .select('id')
      .eq('client_id', user.id)
      .eq('listing_id', params.id)
      .eq('status', 'completed')
      .maybeSingle(),

    admin
      .from('contact_unlocks')
      .select('id')
      .eq('client_id', user.id)
      .eq('dalali_id', listing.dalali_id)
      .eq('status', 'completed')
      .gte('created_at', last24hrs)
      .limit(1)
      .maybeSingle(),
  ])

  if (!directUnlock.data && !dalaliAccess.data) {
    return NextResponse.json({ error: 'Hujafungua mawasiliano haya' }, { status: 403 })
  }

  const { data: profile } = await admin
    .from('dalali_profiles')
    .select('whatsapp_number')
    .eq('id', listing.dalali_id)
    .single()

  return NextResponse.json({ whatsapp_number: profile?.whatsapp_number ?? null })
}
