import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SubscriptionClient from '@/components/dalali/SubscriptionClient'

export default async function DashboardSubscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/subscription')

  const [subscriptionRes, historyRes] = await Promise.all([
    // Subscription ya sasa (active, grace_period, au trial_expired)
    supabase
      .from('subscriptions')
      .select('id, plan, status, expires_at, grace_period_until, starts_at, amount_paid, is_trial, trial_ends_at')
      .eq('dalali_id', user.id)
      .in('status', ['active', 'grace_period', 'trial_expired'])
      .order('expires_at', { ascending: false })
      .maybeSingle(),

    // Historia ya malipo (zote zilizokamilika)
    supabase
      .from('subscriptions')
      .select('id, plan, status, expires_at, starts_at, amount_paid, created_at')
      .eq('dalali_id', user.id)
      .in('status', ['active', 'grace_period', 'expired'])
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const sub     = subscriptionRes.data
  const history = historyRes.data ?? []

  // Count consecutive completed months for loyalty discount
  const completedMonths = history.filter(h => h.status !== 'pending').length

  return (
    <SubscriptionClient
      currentPlan={sub?.plan ?? null}
      currentStatus={sub?.status ?? null}
      expiresAt={sub?.expires_at ?? null}
      gracePeriodUntil={sub?.grace_period_until ?? null}
      completedMonths={completedMonths}
      history={history as HistoryItem[]}
      isTrial={sub?.is_trial ?? false}
      trialEndsAt={sub?.trial_ends_at ?? null}
    />
  )
}

export type HistoryItem = {
  id: string
  plan: string
  status: string
  expires_at: string | null
  starts_at: string | null
  amount_paid: number | null
  created_at: string
}
