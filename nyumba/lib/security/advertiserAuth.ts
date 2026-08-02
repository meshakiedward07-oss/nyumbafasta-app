import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export type AdvertiserRow = {
  id: string
  user_id: string
  business_name: string
  business_category: string
  contact_phone: string
  whatsapp_number: string | null
  email: string
  city: string
  district: string | null
  description: string | null
  logo_url: string | null
  website_url: string | null
  status: 'pending_review' | 'active' | 'rejected' | 'suspended'
}

type AdvertiserAuthResult =
  | { ok: true; advertiser: AdvertiserRow; userId: string }
  | { ok: false; response: NextResponse }

export async function requireAdvertiserAuth(): Promise<AdvertiserAuthResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: advertiser } = await admin
    .from('advertisers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!advertiser) {
    return { ok: false, response: NextResponse.json({ error: 'Wasifu wa mfanyabiashara haupatikani. Jiandikishe kwanza.' }, { status: 403 }) }
  }

  const row = advertiser as AdvertiserRow
  if (row.status === 'rejected') {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti yako ilikataliwa. Wasiliana na msimamizi.' }, { status: 403 }) }
  }
  if (row.status === 'suspended') {
    return { ok: false, response: NextResponse.json({ error: 'Akaunti yako imesimamishwa. Wasiliana na msimamizi.' }, { status: 403 }) }
  }

  return { ok: true, advertiser: row, userId: user.id }
}
