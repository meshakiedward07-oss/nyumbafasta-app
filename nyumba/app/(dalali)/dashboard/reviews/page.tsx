import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DalaliReviewsClient from '@/components/dalali/DalaliReviewsClient'

export default async function DalaliReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/reviews')

  const { data: profile } = await supabase
    .from('dalali_profiles')
    .select('rating_avg, rating_count')
    .eq('user_id', user.id)
    .single()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, rating, comment, created_at,
      is_verified, helpful_count, response, response_at,
      listing_id,
      reviewer:reviewer_id ( full_name )
    `)
    .eq('dalali_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <DalaliReviewsClient
      reviews={(reviews ?? []) as unknown as DalaliReview[]}
      ratingAvg={profile?.rating_avg ?? 0}
      ratingCount={profile?.rating_count ?? 0}
    />
  )
}

export type DalaliReview = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  is_verified: boolean
  helpful_count: number
  response: string | null
  response_at: string | null
  listing_id: string | null
  reviewer: { full_name: string } | null
}
