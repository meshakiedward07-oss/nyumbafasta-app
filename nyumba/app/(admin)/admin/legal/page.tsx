import { createAdminClient } from '@/lib/supabase/server'
import LegalClient from './LegalClient'

export default async function AdminLegalPage() {
  const admin = createAdminClient()

  // Fetch violations with reporter + reported user info
  const { data: violations } = await admin
    .from('agreement_violations')
    .select(`
      id, violation_type, description, status, action_taken, admin_notes,
      created_at, resolved_at, evidence_urls,
      reporter:reporter_id (full_name, role),
      reported:reported_user_id (id, full_name, role, account_status)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch agreement stats
  const { count: totalAgreements } = await admin
    .from('user_agreements')
    .select('*', { count: 'exact', head: true })

  const { count: pendingViolations } = await admin
    .from('agreement_violations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: suspendedUsers } = await admin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('account_status', 'suspended')

  const { count: bannedUsers } = await admin
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('account_status', 'banned')

  return (
    <LegalClient
      violations={violations ?? []}
      stats={{
        totalAgreements: totalAgreements ?? 0,
        pendingViolations: pendingViolations ?? 0,
        suspendedUsers: suspendedUsers ?? 0,
        bannedUsers: bannedUsers ?? 0,
      }}
    />
  )
}
