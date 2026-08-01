import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/security/rateLimit'
import { runDeviceFraudChecks } from '@/lib/fraud/detector'

// Receives device fingerprint from FraudTracker component after user is logged in
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { fingerprint, platform, screenSize, timezone, language } = body as Record<string, string>

    if (!fingerprint) return NextResponse.json({ ok: false }, { status: 400 })

    const admin     = createAdminClient()
    const ip        = getClientIp(req)
    const userAgent = req.headers.get('user-agent') ?? ''

    runDeviceFraudChecks(admin, {
      userId:      user.id,
      fingerprint,
      ipAddress:   ip,
      userAgent,
      platform,
      screenSize,
      timezone,
      language,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
