import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// POST — trigger trial reminders + expire old trials
// Call this from a daily cron job or manually from admin panel
export async function POST(req: NextRequest) {
  try {
    // Verify admin or cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    let isAuthorized = false

    // Allow cron secret from env
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isAuthorized = true
    }

    // Allow admin users
    if (!isAuthorized) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        isAuthorized = profile?.role === 'admin'
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Call the SQL function that sends reminders + expires trials
    const { error } = await admin.rpc('send_trial_reminders')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return summary
    const { data: summary } = await admin
      .from('subscriptions')
      .select('status')
      .eq('is_trial', true)

    const counts = (summary ?? []).reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      ok: true,
      ran_at: new Date().toISOString(),
      trial_summary: counts,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
