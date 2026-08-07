import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendMail } from '@/lib/email/resend'
import { tenantWelcomeEmail, tenantRegisteredEmail } from '@/lib/email/templates'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 401 })
    }

    const meta          = user.user_metadata ?? {}
    const portalType    = (meta.portal_type    as string | undefined) ?? null
    const fullName      = (meta.full_name      as string | undefined) ?? null
    const phone         = (meta.phone          as string | undefined) ?? null
    const orgName       = (meta.org_name       as string | undefined) ?? null
    const city          = (meta.city           as string | undefined) ?? null
    const invitedByOrg  = (meta.invited_by_org as string | undefined) ?? null

    const admin = createAdminClient()

    // Upsert users row — trigger creates it but may miss phone/portal_type columns.
    await admin.from('users').upsert({
      id:          user.id,
      email:       user.email,
      full_name:   fullName,
      phone,
      role:        'client',
      portal_type: portalType,
      is_active:   true,
    }, { onConflict: 'id', ignoreDuplicates: false })

    // For org_owner: create organization + membership
    if (portalType === 'org_owner' && orgName) {
      const { data: existing } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .maybeSingle()

      if (!existing) {
        const { data: org, error: orgErr } = await admin
          .from('organizations')
          .insert({
            name:       orgName,
            org_type:   'landlord',
            phone,
            region:     city ?? null,
            status:     'active',
            created_by: user.id,
          })
          .select('id')
          .single()

        if (orgErr) {
          console.error('Portal register — org creation failed:', orgErr.message)
          return NextResponse.json({ error: 'Imeshindwa kuunda shirika. Jaribu tena.' }, { status: 500 })
        }

        await admin.from('organization_members').insert({
          organization_id: org.id,
          user_id:         user.id,
          role:            'owner',
        })
      }
    }

    // For tenant invited by an org: send notification emails
    if (portalType === 'tenant' && invitedByOrg) {
      try {
        // Look up org name and owner email
        const { data: orgRow } = await admin
          .from('organizations')
          .select('name')
          .eq('id', invitedByOrg)
          .maybeSingle()

        const { data: ownerRow } = await admin
          .from('organization_members')
          .select('users(email, full_name)')
          .eq('organization_id', invitedByOrg)
          .eq('role', 'owner')
          .maybeSingle()

        const resolvedOrgName = orgRow?.name ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ownerData = ownerRow?.users as any
        const ownerEmail: string | null = ownerData?.email ?? null
        const ownerName: string | null  = ownerData?.full_name ?? null

        // Welcome email to tenant
        if (user.email) {
          const { subject, html } = tenantWelcomeEmail(fullName ?? 'Mpangaji', resolvedOrgName ?? undefined)
          sendMail({ to: user.email, subject, html }).catch((e) =>
            console.error('[portal/register] Tenant welcome email failed:', e)
          )
        }

        // Notification email to org owner
        if (ownerEmail) {
          const { subject, html } = tenantRegisteredEmail(
            fullName ?? 'Mpangaji',
            phone ?? null,
            user.email ?? '',
            resolvedOrgName ?? ownerName ?? 'Shirika lako',
          )
          sendMail({ to: ownerEmail, subject, html }).catch((e) =>
            console.error('[portal/register] Org owner notification email failed:', e)
          )
        }
      } catch (emailErr) {
        // Non-fatal — registration still succeeds
        console.error('[portal/register] Email notification error:', emailErr)
      }
    }

    return NextResponse.json({ portal_type: portalType })
  } catch (err) {
    console.error('Portal register error:', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
