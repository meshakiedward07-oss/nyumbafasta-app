import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Temporary diagnostic endpoint — protected by CRON_SECRET
// DELETE this file after testing
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  // Temporary diagnostic token — delete this file after testing
  const DIAG_TOKEN = '4d01c112bdc943544218b729e49971f1'
  if (!secret || secret !== DIAG_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, unknown> = {}

  // 1. Check RESEND_API_KEY
  const resendKey = process.env.RESEND_API_KEY
  results.resend_key_set = !!resendKey
  results.resend_key_prefix = resendKey ? resendKey.slice(0, 6) + '...' : null

  // 2. Check emails table
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('emails')
    .select('id')
    .limit(1)
  results.emails_table_exists = !error
  results.emails_table_error  = error?.message ?? null
  results.emails_count = data?.length ?? null

  // 3. Test Resend send (only if key is set)
  if (resendKey) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(resendKey)
      const { data: sent, error: sendErr } = await resend.emails.send({
        from:    'NyumbaFasta <noreply@nyumbafasta.co>',
        to:      ['meshakiedward07@gmail.com'],
        subject: '✅ NyumbaFasta Email Diagnostic Test',
        html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
  <div style="background:#1D9E75;color:#fff;padding:24px;border-radius:12px;text-align:center;margin-bottom:24px">
    <div style="font-size:32px;margin-bottom:8px">✅</div>
    <h1 style="margin:0;font-size:20px">NyumbaFasta Email — Inafanya Kazi!</h1>
  </div>
  <p style="color:#374151;line-height:1.7">
    Mfumo wa barua pepe unafanya kazi vizuri. Admin na wafanyakazi wanaweza kutuma na kupokea barua pepe.
  </p>
  <p style="color:#374151;line-height:1.7">
    Wateja wanaweza kuwasiliana kupitia: <strong>support@nyumbafasta.co</strong>
  </p>
  <p style="color:#6B7280;font-size:12px;text-align:center;margin-top:24px">
    NyumbaFasta · nyumbafasta.co
  </p>
</div>`,
        replyTo: 'support@nyumbafasta.co',
      })
      results.test_email_sent      = !sendErr
      results.test_email_resend_id = sent?.id ?? null
      results.test_email_error     = sendErr?.message ?? null
    } catch (e) {
      results.test_email_sent  = false
      results.test_email_error = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json(results, { status: 200 })
}
