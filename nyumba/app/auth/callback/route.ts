import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendMail } from '@/lib/email/resend'
import { welcomeEmail, newUserAlertEmail } from '@/lib/email/templates'
import { auditLog } from '@/lib/security/auditLog'
import { getClientIp } from '@/lib/security/rateLimit'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('redirect') || searchParams.get('next') || ''

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // If email is not yet confirmed, confirm it now.
      // The user proved ownership of the email by clicking this link (magic link,
      // password reset, or OAuth callback) — confirming is safe and prevents the
      // "invalid login credentials" error that newer GoTrue returns for unconfirmed emails.
      if (!data.user.email_confirmed_at) {
        const adminClient = createAdminClient()
        await adminClient.auth.admin
          .updateUserById(data.user.id, { email_confirm: true })
          .catch(() => { /* non-fatal — user can still proceed */ })
      }

      // Audit every successful session exchange (covers OAuth, magic link, password reset)
      await auditLog({
        action: 'login_success',
        user_id: data.user.id,
        target_type: 'user',
        ip_address: getClientIp(request),
        severity: 'info',
      })

      // Caller specified a redirect (Google OAuth, password reset) — honour it,
      // BUT skip /register/complete for already-registered users to prevent
      // overwriting their existing role and profile data.
      if (redirect && redirect !== '/') {
        if (redirect.startsWith('/register/complete')) {
          const { data: existingUser } = await supabase
            .from('users')
            .select('role, agreement_accepted')
            .eq('id', data.user.id)
            .maybeSingle()
          // Only skip /register/complete if the user has ALREADY accepted the agreement —
          // new users have agreement_accepted=false even though their row exists (trigger creates
          // the row on signUp before email confirmation, so role alone is not a reliable signal).
          if (existingUser?.role && existingUser?.agreement_accepted === true) {
            const dest = existingUser.role === 'admin'  ? `${origin}/admin`
                       : existingUser.role === 'staff'  ? `${origin}/admin/staff-dashboard`
                       : existingUser.role === 'dalali' ? `${origin}/dashboard`
                       : `${origin}/`
            return NextResponse.redirect(dest)
          }
        }
        return NextResponse.redirect(`${origin}${redirect}`)
      }

      // Ensure public.users row exists (the trigger may have failed silently)
      // This is the safety net: if the row is missing, create it now.
      const adminClient2 = createAdminClient()
      const { data: existingRow } = await adminClient2
        .from('users')
        .select('id, role, full_name, email, must_change_password')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existingRow) {
        const meta = data.user.user_metadata as Record<string, string | undefined>
        const inferredRole = (meta?.role as string | null) ?? 'client'
        await adminClient2.from('users').insert({
          id:        data.user.id,
          email:     data.user.email ?? null,
          phone:     data.user.phone ?? null,
          full_name: meta?.full_name ?? meta?.name ?? (data.user.email?.split('@')[0] ?? 'Mtumiaji'),
          avatar_url: meta?.avatar_url ?? meta?.picture ?? null,
          role:      inferredRole,
          is_active: true,
          is_verified: false,
        }).then(r => {
          if (r.error) console.error('[Auth Callback] Fallback user insert failed:', r.error.message)
        })
      } else if (!existingRow.email && data.user.email) {
        // Row exists but email was never recorded — fill it in
        await adminClient2.from('users').update({ email: data.user.email }).eq('id', data.user.id)
      }

      // Get role from users table (trigger already created it on signUp)
      const { data: profile } = await supabase
        .from('users')
        .select('role, full_name, email, must_change_password, agreement_accepted')
        .eq('id', data.user.id)
        .single()

      const role = profile?.role ?? existingRow?.role ?? (data.user.user_metadata?.role as string | undefined) ?? 'client'

      // For dalali users — ensure dalali_profiles + trial exist
      // (trigger only creates public.users; profile/trial need separate setup)
      if (role === 'dalali') {
        try {
          const admin = createAdminClient()
          const { data: existing } = await admin
            .from('dalali_profiles')
            .select('user_id')
            .eq('user_id', data.user.id)
            .maybeSingle()

          if (!existing) {
            const meta = data.user.user_metadata as Record<string, string | undefined>

            await admin.from('dalali_profiles').upsert(
              {
                user_id: data.user.id,
                whatsapp_number: meta?.whatsapp_number ?? '',
                bio: null,
                rating_avg: 0,
                rating_count: 0,
                is_premium_verified: false,
                trial_used: false,
              },
              { onConflict: 'user_id' }
            )

            const { error: trialErr } = await admin.rpc('start_dalali_trial', { dalali_user_id: data.user.id })
            if (trialErr) console.error('[AuthCallback] start_dalali_trial failed (non-fatal):', trialErr.message)

            // Read back the actual plan so we never promise the Enterprise trial if
            // activation silently fell back to Free (or failed outright).
            const { data: newSub } = await admin
              .from('subscriptions')
              .select('plan')
              .eq('dalali_id', data.user.id)
              .in('status', ['active', 'grace_period'])
              .maybeSingle()
            const gotEnterpriseTrial = newSub?.plan === 'enterprise'

            await admin.from('notifications').insert({
              user_id: data.user.id,
              type: 'trial_started',
              title: gotEnterpriseTrial ? '🎉 Growth Plan ya BURE — Siku 30!' : '👋 Karibu NyumbaFasta!',
              body: gotEnterpriseTrial
                ? 'Hongera! Umepata Growth Plan (Enterprise) ya BURE kwa siku 30. Unaweza kuongeza listings hadi 50, picha 20 kwa kila listing, boost, verified badge, analytics kamili, na zaidi. Baada ya siku 30 chagua plan inayokufaa ili uendelee.'
                : 'Karibu NyumbaFasta! Akaunti yako iko tayari kwenye Free Plan (listings 2). Chagua Basic, Premium au Enterprise wakati wowote ili kuongeza uwezo wako.',
              is_read: false,
            })
          }
        } catch (err) {
          // User can still log in; profile setup retried on next visit — but log it,
          // this used to fail silently which made trial-activation bugs invisible.
          console.error('[AuthCallback] dalali profile/trial setup failed:', err)
        }
      }

      // Send welcome email on FIRST email confirmation (not just within 5 minutes —
      // users often click the verification link hours after signup).
      // We detect "first confirmation" by checking that email_confirmed_at was just
      // set (i.e. it was absent before this code exchange, which we can infer because
      // the callback was reached with a fresh code). We use account age ≤ 7 days as
      // the outer guard so returning users never get a duplicate welcome.
      const { data: userRow } = await supabase
        .from('users')
        .select('created_at, full_name, phone, region')
        .eq('id', data.user.id)
        .single()
      // New user = account created within the last 7 days AND email just confirmed
      const accountAgeMs = userRow?.created_at
        ? Date.now() - new Date(userRow.created_at as string).getTime()
        : Infinity
      const isNewUser = accountAgeMs < 7 * 24 * 60 * 60 * 1000
      const userEmail  = data.user.email
      const userName   = (userRow?.full_name as string | null) ?? (data.user.user_metadata?.full_name as string) ?? 'Mtumiaji'
      const userPhone  = (userRow?.phone as string | null) ?? null
      const userRegion = (userRow?.region as string | null) ?? null

      if (isNewUser) {
        // 1. Welcome email to the new user
        if (userEmail) {
          const { subject, html } = welcomeEmail(userName, role)
          sendMail({ to: userEmail, subject, html })
            .catch(e => console.error('[Auth Callback] Welcome email failed:', e))
        }

        // 2. New-user alert to all active staff + admins (non-blocking)
        if (role === 'dalali' || role === 'client') {
          ;(async () => {
            try {
              const adminClient = createAdminClient()
              const [staffRes, adminRes] = await Promise.all([
                adminClient.from('users').select('id').eq('role', 'staff').eq('staff_active', true),
                adminClient.from('users').select('id').eq('role', 'admin'),
              ])
              const recipientIds = [
                ...(staffRes.data ?? []).map(u => u.id as string),
                ...(adminRes.data ?? []).map(u => u.id as string),
              ]
              const emailList = await Promise.all(
                recipientIds.map(uid =>
                  adminClient.auth.admin.getUserById(uid).then(r => r.data?.user?.email ?? null)
                )
              )
              const recipients = emailList.filter((e): e is string => Boolean(e))

              if (recipients.length > 0 && userEmail) {
                const { subject, html } = newUserAlertEmail(
                  userName, role, userEmail, userPhone, userRegion,
                  (data.user.user_metadata?.source as string | null) ?? null,
                )
                await sendMail({
                  to:      recipients,
                  subject,
                  html,
                  from:    'NyumbaFasta System <noreply@nyumbafasta.co>',
                })
              }
            } catch (e) { console.error('[Auth Callback] Staff/admin alert email failed:', e) }
          })()
        }
      }

      // New user (agreement not yet recorded) — finalise registration here, server-side.
      // agreement data was embedded in user_metadata at signUp() time so it is always
      // available, even on a different device. No /register/complete round-trip needed.
      if ((role === 'client' || role === 'dalali') && profile?.agreement_accepted !== true) {
        const meta    = data.user.user_metadata as Record<string, string | undefined>
        const finRole = role as string
        const adminFin = createAdminClient()

        // 1. Mark agreement accepted + fill in profile details from metadata
        await adminFin.from('users').update({
          full_name:             meta?.full_name    ?? profile?.full_name ?? null,
          agreement_accepted:    true,
          agreement_accepted_at: new Date().toISOString(),
          agreement_version:     meta?.agr_v        ?? null,
          ...(finRole === 'dalali' && meta?.whatsapp_number
            ? {} // whatsapp_number lives in dalali_profiles, handled below
            : {}),
        }).eq('id', data.user.id)

        // 2. Save audit record to user_agreements if we have signature details
        if (meta?.agr_v && meta?.agr_name && meta?.agr_phone) {
          const { data: versionRow } = await adminFin
            .from('agreement_versions')
            .select('id')
            .eq('role', finRole)
            .eq('version', meta.agr_v)
            .eq('is_current', true)
            .maybeSingle()
          if (versionRow) {
            await adminFin.from('user_agreements').upsert(
              {
                user_id:           data.user.id,
                version_id:        versionRow.id,
                accepted_at:       new Date().toISOString(),
                full_name_signed:  meta.agr_name,
                phone_signed:      meta.agr_phone,
                ip_address:        null,
                user_agent:        null,
                checkboxes_checked: {},
              },
              { onConflict: 'user_id,version_id' }
            )
          }
        }
      }

      if (role === 'admin')  return NextResponse.redirect(`${origin}/admin`)
      if (role === 'staff') {
        if (profile?.must_change_password) {
          return NextResponse.redirect(`${origin}/account/change-password`)
        }
        return NextResponse.redirect(`${origin}/admin/staff-dashboard`)
      }
      if (role === 'dalali') return NextResponse.redirect(`${origin}/dashboard?welcome=true`)
      return NextResponse.redirect(`${origin}/?welcome=true`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
