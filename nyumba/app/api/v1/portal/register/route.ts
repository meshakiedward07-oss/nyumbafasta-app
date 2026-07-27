import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 401 })
    }

    const meta        = user.user_metadata ?? {}
    const portalType  = (meta.portal_type  as string | undefined) ?? null
    const fullName    = (meta.full_name    as string | undefined) ?? null
    const phone       = (meta.phone        as string | undefined) ?? null
    const orgName     = (meta.org_name     as string | undefined) ?? null
    const city        = (meta.city         as string | undefined) ?? null

    const admin = createAdminClient()

    // Upsert users row — trigger creates it but may miss phone/portal_type columns.
    // Use service-role client to bypass RLS.
    await admin.from('users').upsert({
      id:        user.id,
      email:     user.email,
      full_name: fullName,
      phone,
      role:      'client',
      is_active: true,
    }, { onConflict: 'id', ignoreDuplicates: false })

    // For org_owner: create organization + membership
    if (portalType === 'org_owner' && orgName) {
      // Check if user already owns an org (idempotency)
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

    return NextResponse.json({ portal_type: portalType })
  } catch (err) {
    console.error('Portal register error:', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
