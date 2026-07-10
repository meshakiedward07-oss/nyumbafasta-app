import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { welcomeEmail } from '@/lib/email/templates'
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
                       : existingUser.role === 'staff'  ? `${origin}/admin/staff-leads`
                       : existingUser.role === 'dalali' ? `${origin}/dashboard`
                       : `${origin}/`
            return NextResponse.redirect(dest)
          }
        }
        return NextResponse.redirect(`${origin}${redirect}`)
      }

      // Get role from users table (trigger already created it on signUp)
      const { data: profile } = await supabase
        .from('users')
        .select('role, full_name, email, must_change_password')
        .eq('id', data.user.id)
        .single()

      const role = profile?.role ?? (data.user.user_metadata?.role as string | undefined) ?? 'client'

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
              data: { trial_days: 14 },
            })
          }
        } catch {
          // Silently continue — user can still log in; profile setup retried on next visit
        }
      }

      // Send welcome email only for new signups (account created within last 60 seconds)
      if (process.env.RESEND_API_KEY) {
        const { data: userRow } = await supabase
          .from('users')
          .select('created_at, email, full_name')
          .eq('id', data.user.id)
          .single()
        const isNewUser = userRow?.created_at
          ? Date.now() - new Date(userRow.created_at as string).getTime() < 60_000
          : false
        if (isNewUser) {
          const userEmail = (userRow?.email as string | null) ?? data.user.email
          const userName = (userRow?.full_name as string | null) ?? (data.user.user_metadata?.full_name as string) ?? 'Mtumiaji'
          if (userEmail) {
            const { subject, html } = welcomeEmail(userName, role)
            new Resend(process.env.RESEND_API_KEY).emails
              .send({ from: 'NyumbaFasta <noreply@nyumbafasta.co>', to: userEmail, subject, html })
              .catch(() => { /* ignore — don't block auth flow */ })
          }
        }
      }

      if (role === 'admin')  return NextResponse.redirect(`${origin}/admin`)
      if (role === 'staff') {
        if (profile?.must_change_password) {
          return NextResponse.redirect(`${origin}/account/change-password`)
        }
        return NextResponse.redirect(`${origin}/admin/staff-leads`)
      }
      if (role === 'dalali') return NextResponse.redirect(`${origin}/dashboard?welcome=true`)
      return NextResponse.redirect(`${origin}/?welcome=true`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
