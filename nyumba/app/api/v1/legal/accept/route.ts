import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/security/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { version, full_name_signed, phone_signed, checkboxes_checked } = await req.json()

    if (!version || !full_name_signed || !phone_signed) {
      return NextResponse.json({ error: 'Taarifa zinazohitajika zimekosekana' }, { status: 400 })
    }
    if (full_name_signed.trim().length < 3) {
      return NextResponse.json({ error: 'Jina kamili linahitajika' }, { status: 400 })
    }
    if (phone_signed.trim().length < 9) {
      return NextResponse.json({ error: 'Nambari ya simu si sahihi' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get user's role
    const { data: userData } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'Mtumiaji hapatikani' }, { status: 404 })
    }

    // Look up the agreement version
    const { data: versionRow } = await admin
      .from('agreement_versions')
      .select('id')
      .eq('role', userData.role)
      .eq('version', version)
      .eq('is_current', true)
      .maybeSingle()

    if (!versionRow) {
      return NextResponse.json({ error: 'Toleo la makubaliano halikupatikana' }, { status: 404 })
    }

    // Save acceptance record
    const { error: insertError } = await admin.from('user_agreements').upsert(
      {
        user_id:           user.id,
        version_id:        versionRow.id,
        accepted_at:       new Date().toISOString(),
        full_name_signed:  full_name_signed.trim(),
        phone_signed:      phone_signed.trim(),
        ip_address:        getClientIp(req),
        user_agent:        req.headers.get('user-agent') ?? null,
        checkboxes_checked: checkboxes_checked ?? {},
      },
      { onConflict: 'user_id,version_id' }
    )

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Mark user as agreement_accepted — do NOT override account_status for suspended/banned users
    const updateData: Record<string, unknown> = {
      agreement_accepted:    true,
      agreement_accepted_at: new Date().toISOString(),
      agreement_version:     version,
    }
    const { data: currentStatus } = await admin
      .from('users').select('account_status').eq('id', user.id).single()
    if (!currentStatus?.account_status || currentStatus.account_status === 'pending') {
      updateData.account_status = 'active'
    }
    await admin.from('users').update(updateData).eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
