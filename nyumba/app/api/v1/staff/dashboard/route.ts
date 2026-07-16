import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ADMIN_TASK_PERMISSIONS } from '@/lib/staff/permissions'
import type { PermissionKey } from '@/lib/staff/permissions'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('id, full_name, staff_title, role_template, role, staff_active')
    .eq('id', user.id)
    .single()

  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile?.role === 'staff' && !profile?.staff_active) {
    return NextResponse.json({ error: 'Account imezimwa' }, { status: 403 })
  }

  // Get permissions
  let permissions: PermissionKey[] = []
  if (profile?.role === 'admin') {
    const { STAFF_PERMISSIONS } = await import('@/lib/staff/permissions')
    permissions = Object.keys(STAFF_PERMISSIONS) as PermissionKey[]
  } else {
    const { data: rows } = await admin
      .from('staff_permissions')
      .select('permission_key')
      .eq('staff_id', user.id)
    permissions = (rows ?? []).map(r => r.permission_key as PermissionKey)
  }

  const hasAdminTasks = permissions.some(p => ADMIN_TASK_PERMISSIONS.includes(p))

  // ── Parallel fetches based on permissions ──────────────────────────────
  const [
    pendingListingsRes,
    openReportsRes,
    pendingVerifRes,
    myLeadsRes,
    activityRes,
    assignmentsRes,
  ] = await Promise.all([
    // Pending listings (if approve_listings or admin)
    permissions.includes('approve_listings') || profile?.role === 'admin'
      ? admin.from('listings')
          .select('id, title, type, region, district, price_monthly, images, created_at, dalali:dalali_id(id, full_name, phone)', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [], count: 0 }),

    // Open reports (if handle_reports or admin)
    permissions.includes('handle_reports') || profile?.role === 'admin'
      ? admin.from('reports')
          .select('id, reason, details, status, created_at, reporter:reporter_id(id, full_name), dalali:reported_dalali_id(id, full_name)', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [], count: 0 }),

    // Pending verifications (if manage_verifications or admin)
    permissions.includes('manage_verifications') || profile?.role === 'admin'
      ? admin.from('users')
          .select('id, full_name, phone, created_at, dalali_profiles!inner(is_premium_verified, nida_number, business_license_url)', { count: 'exact' })
          .eq('role', 'dalali')
          .eq('dalali_profiles.is_premium_verified', false)
          .not('dalali_profiles.nida_number', 'is', null)
          .limit(20)
      : Promise.resolve({ data: [], count: 0 }),

    // My active leads (if leads)
    permissions.includes('leads')
      ? admin.from('agent_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .not('pipeline_stage', 'in', '(amefanikiwa,amepotea)')
      : Promise.resolve({ count: 0 }),

    // Recent staff activity
    admin.from('staff_activity_log')
      .select('id, action_type, resource_type, description, created_at')
      .eq('staff_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15),

    // Assignments from admin
    admin.from('staff_assignments')
      .select('id, title, description, category, priority, status, ref_type, ref_id, due_date, created_at, assigned_by_user:assigned_by(full_name)')
      .eq('staff_id', user.id)
      .neq('status', 'completed')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  // Users to review if manage_users
  let usersData: unknown[] = []
  let usersCount = 0
  if (permissions.includes('manage_users') || profile?.role === 'admin') {
    const { data, count } = await admin
      .from('users')
      .select('id, full_name, phone, role, is_active, account_status, created_at', { count: 'exact' })
      .in('role', ['dalali', 'client'])
      .or('is_active.eq.false,account_status.eq.suspended,account_status.eq.banned')
      .order('created_at', { ascending: false })
      .limit(20)
    usersData = data ?? []
    usersCount = count ?? 0
  }

  // Expiring subscriptions if manage_subscriptions
  let subsData: unknown[] = []
  let subsCount = 0
  if (permissions.includes('manage_subscriptions') || profile?.role === 'admin') {
    const in7days = new Date(Date.now() + 7 * 86_400_000).toISOString()
    const { data, count } = await admin
      .from('subscriptions')
      .select('id, plan, status, expires_at, grace_period_until, dalali:dalali_id(id, full_name, phone)', { count: 'exact' })
      .in('status', ['active', 'grace_period'])
      .neq('plan', 'free')
      .lte('expires_at', in7days)
      .order('expires_at', { ascending: true })
      .limit(20)
    subsData = data ?? []
    subsCount = count ?? 0
  }

  // Personal performance counters — all scoped to this staff member
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekStart  = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [
    { count: completedToday },
    { count: completedThisWeek },
    { count: completedThisMonth },
    { count: myAssignmentsTotal },
    { count: myAssignmentsCompleted },
    { count: pendingAssignments },
  ] = await Promise.all([
    admin.from('staff_activity_log').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id).gte('created_at', todayStart.toISOString()),
    admin.from('staff_activity_log').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id).gte('created_at', weekStart.toISOString()),
    admin.from('staff_activity_log').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id).gte('created_at', monthStart.toISOString()),
    admin.from('staff_assignments').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id),
    admin.from('staff_assignments').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id).eq('status', 'completed'),
    admin.from('staff_assignments').select('id', { count: 'exact', head: true })
      .eq('staff_id', user.id).in('status', ['pending', 'in_progress']),
  ])

  return NextResponse.json({
    staff: {
      id: profile?.id,
      full_name: profile?.full_name,
      staff_title: profile?.staff_title,
      role_template: profile?.role_template,
      role: profile?.role,
    },
    permissions,
    hasAdminTasks,
    stats: {
      pendingListings: pendingListingsRes.count ?? 0,
      openReports:     openReportsRes.count ?? 0,
      pendingVerifications: pendingVerifRes.count ?? 0,
      usersToReview:   usersCount,
      expiringSubs:    subsCount,
      myActiveLeads:   myLeadsRes.count ?? 0,
      completedToday:  completedToday  ?? 0,
      completedThisWeek:  completedThisWeek  ?? 0,
      completedThisMonth: completedThisMonth ?? 0,
      myAssignmentsTotal:     myAssignmentsTotal     ?? 0,
      myAssignmentsCompleted: myAssignmentsCompleted ?? 0,
      pendingAssignments:     pendingAssignments     ?? 0,
    },
    listings:      pendingListingsRes.data ?? [],
    reports:       openReportsRes.data ?? [],
    verifications: pendingVerifRes.data ?? [],
    users:         usersData,
    subscriptions: subsData,
    recentActivity: activityRes.data ?? [],
    assignments:   assignmentsRes.data ?? [],
  })
}
