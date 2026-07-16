import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { Resend } from 'resend'
import { staffWelcomeEmail } from '@/lib/email/templates'
import { STAFF_ROLE_TEMPLATES } from '@/lib/staff/permissions'
import type { RoleTemplate } from '@/lib/staff/permissions'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── GET — list all staff with performance stats ──────────────────────────────
export async function GET() {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()

  const { data: staff, error } = await admin
    .from('users')
    .select('id, full_name, email, phone, staff_title, staff_active, max_leads_capacity, created_at')
    .eq('role', 'staff')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const staffIds = (staff || []).map(s => s.id)

  // Fetch leads stats + permissions in parallel
  const [leadsResult, permsResult] = await Promise.all([
    staffIds.length > 0
      ? admin.from('agent_leads').select('assigned_to, pipeline_stage').in('assigned_to', staffIds)
      : Promise.resolve({ data: [] as { assigned_to: string; pipeline_stage: string }[] }),
    staffIds.length > 0
      ? admin.from('staff_permissions').select('staff_id, permission_key').in('staff_id', staffIds)
      : Promise.resolve({ data: [] as { staff_id: string; permission_key: string }[] }),
  ])

  type StaffStats = { activeLeads: number; totalConverted: number; totalLost: number }
  const statsMap: Record<string, StaffStats> = {}
  for (const lead of leadsResult.data ?? []) {
    if (!statsMap[lead.assigned_to]) statsMap[lead.assigned_to] = { activeLeads: 0, totalConverted: 0, totalLost: 0 }
    if (lead.pipeline_stage === 'amefanikiwa') statsMap[lead.assigned_to].totalConverted++
    else if (lead.pipeline_stage === 'amepotea')  statsMap[lead.assigned_to].totalLost++
    else                                           statsMap[lead.assigned_to].activeLeads++
  }

  const permsMap: Record<string, string[]> = {}
  for (const p of permsResult.data ?? []) {
    if (!permsMap[p.staff_id]) permsMap[p.staff_id] = []
    permsMap[p.staff_id].push(p.permission_key)
  }

  const staffWithStats = (staff || []).map(s => ({
    ...s,
    ...(statsMap[s.id] ?? { activeLeads: 0, totalConverted: 0, totalLost: 0 }),
    permissions: permsMap[s.id] ?? [],
  }))

  return NextResponse.json({ staff: staffWithStats })
}

// ─── POST — create new staff account ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let body: { name?: string; phone?: string; email?: string; staffTitle?: string; maxLeadsCapacity?: number; roleTemplate?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, phone, email, staffTitle, maxLeadsCapacity, roleTemplate } = body

  if (!name || !phone || !email) {
    return NextResponse.json(
      { error: 'Jina, namba ya simu, na email vinahitajika' },
      { status: 400 }
    )
  }

  if (!/^255\d{9}$/.test(phone)) {
    return NextResponse.json(
      { error: 'Namba ya simu lazima iwe format 255XXXXXXXXX (mfano: 255712345678)' },
      { status: 400 }
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email si sahihi' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Dedup phone via public.users (email dedup is handled by auth.admin.createUser below)
  const { data: byPhone } = await admin
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (byPhone) {
    return NextResponse.json(
      { error: 'Namba ya simu tayari inatumika' },
      { status: 409 }
    )
  }

  const tempPassword = generateTempPassword()

  // Create auth user — email_confirm: true skips verification email for staff
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: 'staff',
    },
  })

  if (authError || !authData.user) {
    console.error('[Staff] Auth creation failed:', authError?.message)
    // Supabase returns "User already registered" for duplicate email
    const isDupEmail = authError?.message?.toLowerCase().includes('already registered') ||
                       authError?.message?.toLowerCase().includes('already been registered')
    return NextResponse.json(
      { error: isDupEmail ? 'Email tayari inatumika' : `Imeshindwa kuunda akaunti: ${authError?.message ?? 'Hitilafu ya seva'}` },
      { status: isDupEmail ? 409 : 500 }
    )
  }

  const userId = authData.user.id

  // Upsert the users row (handles both: trigger already created it OR trigger hasn't fired yet)
  // email is synced from auth.users via DB trigger — do not write it directly
  const { data: profile, error: profileError } = await admin
    .from('users')
    .upsert(
      {
        id: userId,
        full_name: name,
        role: 'staff',
        phone,
        staff_title: staffTitle || 'Sales Agent',
        staff_active: true,
        max_leads_capacity: maxLeadsCapacity ?? 500,
        must_change_password: true,
      },
      { onConflict: 'id' }
    )
    .select('id, full_name, phone, staff_title, staff_active, max_leads_capacity')
    .single()

  if (profileError) {
    // Rollback: delete auth user so we don't leave orphaned auth records
    await admin.auth.admin.deleteUser(userId)
    console.error('[Staff] Profile upsert failed:', profileError.message)
    return NextResponse.json({ error: `Imeshindwa kuunda profile: ${profileError.message}` }, { status: 500 })
  }

  // Apply initial permissions from role template
  let templateApplied = false
  if (roleTemplate) {
    try {
      await applyRoleTemplate(userId, roleTemplate, admin)
      templateApplied = true
    } catch (err) {
      // Non-fatal — admin will see a warning in the response
      console.error('[Staff] Role template apply failed:', err)
    }
  }

  // Send credentials via email (non-blocking)
  sendStaffCredentialsEmail(email, name, tempPassword).catch(err =>
    console.error('[Staff] Email send failed:', err)
  )

  return NextResponse.json({
    success: true,
    staff: profile,
    message: `Akaunti ya ${name} imeundwa. Maelezo ya kuingia yametumwa kwa email ${email}.`,
    ...(roleTemplate && !templateApplied ? { warning: 'Ruhusa za mwanzo hazikuwekwa — weka kwa mkono kupitia Ruhusa.' } : {}),
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

async function applyRoleTemplate(
  userId: string,
  templateKey: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
): Promise<void> {
  const template = STAFF_ROLE_TEMPLATES[templateKey as RoleTemplate]
  if (!template) return

  await admin.from('staff_permissions').delete().eq('staff_id', userId)
  await admin.from('staff_permissions').insert(
    template.permissions.map(key => ({ staff_id: userId, permission_key: key }))
  )
  await admin.from('users').update({ role_template: templateKey }).eq('id', userId)
}

async function sendStaffCredentialsEmail(
  email: string,
  name: string,
  password: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Staff] RESEND_API_KEY not set — credentials email not sent to', email)
    return
  }
  const { subject, html } = staffWelcomeEmail(name, email, password)
  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'NyumbaFasta <noreply@nyumbafasta.co>',
    to: email,
    subject,
    html,
  })
}
