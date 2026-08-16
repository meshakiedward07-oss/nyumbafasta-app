import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/security/rateLimit'
import { runFraudChecks } from '@/lib/fraud/detector'

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
    const referralCode: string | null = typeof body.referral_code === 'string' ? body.referral_code.trim().toUpperCase() : null

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

    // Check if user already has a profile — never overwrite their existing role.
    // A dalali re-calling /register must not lose their dalali status (or gain a free trial).
    const { data: existingUser } = await admin
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    const isNewUser = !existingUser

    // Block role switching for existing accounts
    if (!isNewUser && existingUser?.role !== role) {
      return NextResponse.json(
        { error: 'Akaunti yako tayari ipo. Tafadhali ingia tu.' },
        { status: 409 }
      )
    }

    // Step 1: Guarantee public.users row exists before any FK references.
    // Only set `role` for brand-new users — never overwrite an existing role.
    const { error: userError } = await admin.from('users').upsert(
      {
        id:        user.id,
        phone:     user.phone || null,
        full_name,
        ...(isNewUser ? { role } : {}),
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

    // Step 2b: Fraud checks — fire-and-forget, never block registration
    runFraudChecks(admin, {
      userId: user.id,
      phone:  body.whatsapp_number ?? user.phone ?? undefined,
      ip:     getClientIp(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    // Step 3: Dalali-specific setup — only for new dalali accounts
    if (role === 'dalali') {
      const dalaliUpsert: Record<string, unknown> = {
        user_id:         user.id,
        whatsapp_number: whatsapp_number ?? '',
      }

      if (isNewUser) {
        // Only set these on first registration — don't reset trial_used for re-registrations
        Object.assign(dalaliUpsert, {
          bio:                 null,
          rating_avg:          0,
          rating_count:        0,
          is_premium_verified: false,
          trial_used:          false,
        })
      }

      const { error: profileError } = await admin.from('dalali_profiles').upsert(
        dalaliUpsert,
        { onConflict: 'user_id' }
      )
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 })
      }

      if (isNewUser) {
        // Step 4: Start 14-day trial for new dalali only
        const { error: trialErr } = await admin.rpc('start_dalali_trial', { dalali_user_id: user.id })
        if (trialErr) console.error('[Register] start_dalali_trial failed (non-fatal):', trialErr.message)

        // Step 5: Welcome notification
        await admin.from('notifications').insert({
          user_id: user.id,
          type:    'trial_started',
          title:   '🎉 Karibu NyumbaFasta!',
          body:    'Umepata siku 14 za BURE! Anza kuongeza listings sasa na upate wateja wako wa kwanza.',
          is_read: false,
        })

        // Step 6: Referral attribution (non-fatal — never blocks registration)
        if (referralCode) {
          try {
            const { data: influencerProfile } = await admin
              .from('influencer_profiles')
              .select('id')
              .eq('referral_code', referralCode)
              .eq('is_active', true)
              .maybeSingle()
            if (influencerProfile) {
              await admin.from('referral_attributions').insert({
                influencer_id:    influencerProfile.id,
                referred_user_id: user.id,
                referral_code:    referralCode,
                signed_up_at:     new Date().toISOString(),
              })
            }
          } catch (refErr) {
            console.error('[Register] Referral attribution failed (non-fatal):', refErr)
          }
        }
      }
    }

    return NextResponse.json({ success: true, role })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
