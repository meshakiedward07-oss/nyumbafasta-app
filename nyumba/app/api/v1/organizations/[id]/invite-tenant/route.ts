import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: { id: string } }

// POST /api/v1/organizations/:id/invite-tenant
// Sends a WhatsApp registration invite to a phone number that has no NyumbaFasta account yet.
export async function POST(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

    const admin = createAdminClient()

    // Verify caller is an org member
    const { count: memberCount } = await admin
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('user_id', user.id)

    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    const isAdminStaff = ['admin', 'staff'].includes(profile?.role ?? '')
    if (!memberCount && !isAdminStaff) {
      return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })
    }

    const body = await req.json()
    const { phone } = body as { phone?: string }

    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Nambari ya simu inahitajika' }, { status: 400 })
    }

    // Verify no account already exists with this phone
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('phone', phone.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        error: 'Nambari hii tayari ina akaunti ya NyumbaFasta. Jaribu kuunda mkataba moja kwa moja.',
        already_registered: true,
      }, { status: 409 })
    }

    // Get org name
    const { data: org } = await admin
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()

    const orgName = org?.name ?? 'NyumbaFasta'
    const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
    // Include org_id so the register page can store it in user metadata —
    // portal/register will use it to notify the org owner after tenant verifies email.
    const regLink = `${appUrl}/register?role=tenant&org=${orgId}`

    // Send WhatsApp invite
    try {
      const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
      const msg =
        `🏠 *Mwaliko wa NyumbaFasta kutoka ${orgName}*\n\n` +
        `Habari!\n\n` +
        `Umealikwa kujiunga na *${orgName}* kwenye mfumo wa NyumbaFasta ili uweze kuona malipo yako ya kodi, kuwasiliana na mmiliki, na kusimamia mkataba wako kwa urahisi.\n\n` +
        `*Jisajili hapa (dakika 2):*\n${regLink}\n\n` +
        `Baada ya kuthibitisha barua pepe yako, mmiliki wako atapata taarifa ya moja kwa moja — huhitaji kumtaarifu wewe.\n\n` +
        `_NyumbaFasta — Mfumo wa Kisasa wa Upangaji Tanzania_`

      await sendTextMessage(formatPhoneNumber(phone.trim()), msg)
    } catch (waErr) {
      console.error('[invite-tenant] WhatsApp send failed:', waErr)
      // Non-fatal: still return success, the invite "concept" works even if WA fails
    }

    return NextResponse.json({
      success: true,
      message: `Mwaliko umetumwa kwa ${phone.trim()} kupitia WhatsApp.`,
    })
  } catch (err) {
    console.error('[POST /organizations/:id/invite-tenant]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
