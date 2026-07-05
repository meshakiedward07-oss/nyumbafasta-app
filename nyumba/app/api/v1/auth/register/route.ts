import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'

interface AgreementPayload {
  version: string
  full_name_signed: string
  phone_signed: string
  checkboxes_checked: Record<string, boolean>
}

export async function POST(req: NextRequest) {
  try {
    // 5 registrations per hour per IP
    const rl = await rateLimit(`register:${getClientIp(req)}`, 5, 60 * 60 * 1000)
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Maombi mengi sana. Jaribu tena baadaye.' }, { status: 429 })
    }

    const body = await req.json()
    const { full_name, role, whatsapp_number } = body
    const agreement: AgreementPayload | null = body.agreement ?? null

    if (!full_name || !role) {
      return NextResponse.json({ error: 'full_name na role vinahitajika' }, { status: 400 })
    }
    if (!['client', 'dalali'].includes(role)) {
      return NextResponse.json({ error: 'Role si sahihi' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Step 1: Guarantee public.users row exists before any FK references.
    const { error: userError } = await admin.from('users').upsert(
      {
        id:        user.id,
        phone:     user.phone ?? null,
        full_name,
        role,
        avatar_url: user.user_metadata?.avatar_url ?? null,
        agreement_accepted:    !!agreement,
        agreement_accepted_at: agreement ? new Date().toISOString() : null,
        agreement_version:     agreement?.version ?? null,
        account_status:        'active',
      },
      { onConflict: 'id' }
    )
    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    // Step 2: Save agreement record if provided
    if (agreement) {
      // Look up the version record
      const { data: versionRow } = await admin
        .from('agreement_versions')
        .select('id')
        .eq('role', role)
        .eq('version', agreement.version)
        .eq('is_current', true)
        .maybeSingle()

      if (versionRow) {
        await admin.from('user_agreements').upsert(
          {
            user_id:           user.id,
            version_id:        versionRow.id,
            accepted_at:       new Date().toISOString(),
            full_name_signed:  agreement.full_name_signed,
            phone_signed:      agreement.phone_signed,
            ip_address:        getClientIp(req),
            user_agent:        req.headers.get('user-agent') ?? null,
            checkboxes_checked: agreement.checkboxes_checked,
          },
          { onConflict: 'user_id,version_id' }
        )
      }
    }

    // Step 3: Create dalali_profiles — safe now that parent row is guaranteed.
    if (role === 'dalali') {
      const { error: profileError } = await admin.from('dalali_profiles').upsert(
        {
          user_id:             user.id,
          whatsapp_number:     whatsapp_number ?? '',
          bio:                 null,
          rating_avg:          0,
          rating_count:        0,
          is_premium_verified: false,
          trial_used:          false,
        },
        { onConflict: 'user_id' }
      )
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }

      // Step 4: Anzisha trial ya siku 14 kwa dalali mpya
      await admin.rpc('start_dalali_trial', { dalali_user_id: user.id })

      // Step 5: Welcome notification
      await admin.from('notifications').insert({
        user_id: user.id,
        type:    'trial_started',
        title:   '🎉 Karibu NyumbaFasta!',
        body:    'Umepata siku 14 za BURE! Anza kuongeza listings sasa na upate wateja wako wa kwanza.',
        is_read: false,
        data:    { trial_days: 14 },
      })
    }

    return NextResponse.json({ success: true, role })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
