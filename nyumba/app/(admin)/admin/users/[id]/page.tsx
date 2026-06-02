import { redirect, notFound } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import DalaliDetailClient from '@/components/admin/DalaliDetailClient'

export type DalaliDetail = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  avatar_url: string | null
  is_active: boolean | null
  created_at: string
  dalali_profiles: {
    whatsapp_number: string | null
    bio: string | null
    rating_avg: number | null
    rating_count: number | null
    is_premium_verified: boolean
    verification_status: string | null
    verification_rejected_reason: string | null
  } | null
  subscriptions: {
    plan: string
    status: string
    expires_at: string | null
    amount_paid: number | null
  }[]
  listings_count: number
  leads_count: number
  total_views: number
}

export default async function DalaliDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

  const admin = createAdminClient()

  const [userRes, listingsRes, leadsRes] = await Promise.all([
    admin
      .from('users')
      .select(`
        id, full_name, email, phone, avatar_url, is_active, created_at,
        dalali_profiles ( whatsapp_number, bio, rating_avg, rating_count, is_premium_verified, verification_status, verification_rejected_reason ),
        subscriptions ( plan, status, expires_at, amount_paid )
      `)
      .eq('id', params.id)
      .eq('role', 'dalali')
      .single(),

    admin
      .from('listings')
      .select('id, view_count', { count: 'exact' })
      .eq('dalali_id', params.id),

    admin
      .from('contact_unlocks')
      .select('id', { count: 'exact', head: true })
      .eq('dalali_id', params.id)
      .eq('status', 'completed'),
  ])

  if (!userRes.data) notFound()

  const raw = userRes.data as unknown as Omit<DalaliDetail, 'listings_count' | 'leads_count' | 'total_views'>
  const dalali: DalaliDetail = {
    ...raw,
    listings_count: listingsRes.count ?? 0,
    leads_count: leadsRes.count ?? 0,
    total_views: (listingsRes.data ?? []).reduce((sum, l) => sum + ((l as { view_count?: number }).view_count ?? 0), 0),
  }

  return <DalaliDetailClient dalali={dalali} />
}
