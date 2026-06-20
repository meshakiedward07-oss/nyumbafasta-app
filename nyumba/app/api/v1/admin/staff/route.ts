import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { sendTextMessage } from '@/lib/whatsapp/client'
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

  const staffWithStats = await Promise.all(
    (staff || []).map(async (s) => {
      const [{ count: activeLeads }, { count: totalConverted }] = await Promise.all([
        admin
          .from('agent_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', s.id)
          .not('pipeline_stage', 'in', '("registered","lost")'),
        admin
          .from('agent_leads')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', s.id)
          .eq('pipeline_stage', 'registered'),
      ])
      return { ...s, activeLeads: activeLeads ?? 0, totalConverted: totalConverted ?? 0 }
    })
  )

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

  const admin = createAdminClient()

  // Dedup — check phone or email already used
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .or(`phone.eq.${phone},email.eq.${email}`)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'Namba ya simu au email tayari inatumika' },
      { status: 409 }
    )
  }

  const tempPassword = generateTempPassword()

  // Create auth user — email_confirm skips verification for staff
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
    return NextResponse.json({ error: 'Imeshindwa kuunda akaunti' }, { status: 500 })
  }

  const userId = authData.user.id

  // Update the users row the trigger created with staff-specific fields
  const { data: profile, error: profileError } = await admin
    .from('users')
    .update({
      phone,
      staff_title: staffTitle || 'Sales Agent',
      staff_active: true,
      max_leads_capacity: maxLeadsCapacity ?? 20,
      must_change_password: true,
    })
    .eq('id', userId)
    .select('id, full_name, email, phone, staff_title, staff_active, max_leads_capacity')
    .single()

  if (profileError) {
    // Rollback: delete auth user so we don't leave orphaned auth records
    await admin.auth.admin.deleteUser(userId)
    console.error('[Staff] Profile update failed:', profileError.message)
    return NextResponse.json({ error: 'Imeshindwa kuunda profile' }, { status: 500 })
  }

  // Apply initial permissions from role template (non-blocking)
  if (roleTemplate) {
    applyRoleTemplate(userId, roleTemplate, admin).catch(err =>
      console.error('[Staff] Role template apply failed:', err)
    )
  }

  // Send credentials via WhatsApp (non-blocking — never fails the request)
  sendStaffCredentials(phone, name, email, tempPassword).catch(err =>
    console.error('[Staff] WhatsApp credentials send failed:', err)
  )

  return NextResponse.json({
    success: true,
    staff: profile,
    message: `Akaunti ya ${name} imeundwa. Maelezo ya kuingia yametumwa kwa WhatsApp.`,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
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

async function sendStaffCredentials(
  phone: string,
  name: string,
  email: string,
  password: string,
): Promise<void> {
  await sendTextMessage(
    phone,
    `👋 Karibu kwenye Timu ya NyumbaFasta, ${name}!

Akaunti yako ya staff imeundwa. Maelezo ya kuingia:

🔗 Link: nyumbafasta.co/login
📧 Email: ${email}
🔑 Password ya muda: ${password}

⚠️ Tafadhali badilisha password mara baada ya kuingia mara ya kwanza kwa usalama wako.

Kazi yako: Kuwasiliana na madalali watarajiwa walioko kwenye CRM yetu na kuwakaribisha kujiunga na NyumbaFasta.

Karibu sana! 🎉`,
  )
}
