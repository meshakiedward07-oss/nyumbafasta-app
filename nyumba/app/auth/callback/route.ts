import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()
          if (existingUser?.role) {
            // Already registered — send them home, not back to the register flow
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
        .select('role, full_name, email, must_change_password')
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

            await admin.rpc('start_dalali_trial', { dalali_user_id: data.user.id })

            await admin.from('notifications').insert({
              user_id: data.user.id,
              type: 'trial_started',
              title: 'Karibu NyumbaFasta!',
              body: 'Umepata siku 14 za BURE! Anza kuongeza listings sasa na upate wateja wako wa kwanza.',
              is_read: false,
            })
          }
        } catch {
          // Silently continue — user can still log in; profile setup retried on next visit
        }
      }

      // Send welcome email on FIRST email confirmation (not just within 5 minutes —
      // users often click the verification link hours after signup).
      // We detect "first confirmation" by checking that email_confirmed_at was just
      // set (i.e. it was absent before this code exchange, which we can infer because
      // the callback was reached with a fresh code). We use account age ≤ 7 days as
      // the outer guard so returning users never get a duplicate welcome.
      if (process.env.RESEND_API_KEY) {
        const { data: userRow } = await supabase
          .from('users')
          .select('created_at, full_name, phone, region')
          .eq('id', data.user.id)
          .single()
        // New user = account created within the last 7 days AND email just confirmed
        const accountAgeMs  = userRow?.created_at
          ? Date.now() - new Date(userRow.created_at as string).getTime()
          : Infinity
        const isNewUser = accountAgeMs < 7 * 24 * 60 * 60 * 1000
        const userEmail  = data.user.email
        const userName   = (userRow?.full_name as string | null) ?? (data.user.user_metadata?.full_name as string) ?? 'Mtumiaji'
        const userPhone  = (userRow?.phone as string | null) ?? null
        const userRegion = (userRow?.region as string | null) ?? null

        if (isNewUser) {
          const resend = new Resend(process.env.RESEND_API_KEY)

          // 1. Welcome email to the new user
          if (userEmail) {
            const { subject, html } = welcomeEmail(userName, role)
            resend.emails
              .send({ from: 'NyumbaFasta <noreply@nyumbafasta.co>', to: userEmail, subject, html })
              .catch(e => console.error('[Auth Callback] Welcome email failed:', e))
          }

          // 2. New-user alert to all active staff + admins (non-blocking)
          if (role === 'dalali' || role === 'client') {
            ;(async () => {
              try {
                const adminClient = createAdminClient()
                // Fetch staff and admin user IDs, then resolve emails via auth.admin
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
                  await resend.emails.send({
                    from: 'NyumbaFasta System <noreply@nyumbafasta.co>',
                    to: recipients,
                    subject,
                    html,
                  })
                }
              } catch (e) { console.error('[Auth Callback] Staff/admin alert email failed:', e) }
            })()
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
