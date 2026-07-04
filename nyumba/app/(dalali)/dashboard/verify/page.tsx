import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VerifyWizard from '@/components/dalali/VerifyWizard'

export default async function VerifyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/dashboard/verify')

  const { data: profile } = await createAdminClient()
    .from('dalali_profiles')
    .select('verification_status, verification_rejected_reason, whatsapp_number')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <VerifyWizard
      currentStatus={(profile?.verification_status ?? 'unverified') as string}
      rejectionReason={profile?.verification_rejected_reason ?? null}
      hasWhatsapp={!!profile?.whatsapp_number}
    />
  )
}
