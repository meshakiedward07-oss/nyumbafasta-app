import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import ContactHistoryClient from '@/components/client/ContactHistoryClient'

export default async function ContactHistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/account/contacts')

  const { data: contacts } = await createAdminClient()
    .from('contact_unlocks')
    .select(`
      id, created_at, amount_paid, client_notes,
      listings (
        id, title, type, price_monthly,
        district, region, images, status
      ),
      dalali:dalali_id (
        id, full_name, avatar_url, phone,
        dalali_profiles ( whatsapp_number, rating_avg, is_premium_verified )
      )
    `)
    .eq('client_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  const totalSpent = (contacts ?? []).reduce((sum, c) => sum + (c.amount_paid ?? 0), 0)

  return (
    <ContactHistoryClient
      contacts={(contacts ?? []) as unknown as ContactItem[]}
      totalSpent={totalSpent}
    />
  )
}

export type ContactItem = {
  id: string
  created_at: string
  amount_paid: number | null
  client_notes: string | null
  listings: {
    id: string
    title: string
    type: string
    price_monthly: number
    district: string
    region: string
    images: string[]
    status: string
  } | null
  dalali: {
    id: string
    full_name: string
    avatar_url: string | null
    phone: string | null
    dalali_profiles: {
      whatsapp_number: string | null
      rating_avg: number
      is_premium_verified: boolean
    } | null
  } | null
}
