import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Protected endpoint — returns dalali WhatsApp number ONLY after verified payment.
// Never call this before payment confirmation; the server re-validates the unlock.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

  const admin = createAdminClient()

  // Must have a completed unlock for this exact listing
  const { data: unlock } = await admin
    .from('contact_unlocks')
    .select('id')
    .eq('client_id', user.id)
    .eq('listing_id', params.id)
    .eq('status', 'completed')
    .maybeSingle()

  if (!unlock) {
    return NextResponse.json({ error: 'Hujafungua mawasiliano haya' }, { status: 403 })
  }

  const { data: listing } = await admin
    .from('listings')
    .select('dalali_id')
    .eq('id', params.id)
    .single()

  if (!listing) return NextResponse.json({ error: 'Listing haipatikani' }, { status: 404 })

  const { data: profile } = await admin
    .from('dalali_profiles')
    .select('whatsapp_number')
    .eq('user_id', listing.dalali_id)
    .single()

  return NextResponse.json({ whatsapp_number: profile?.whatsapp_number ?? null })
}
