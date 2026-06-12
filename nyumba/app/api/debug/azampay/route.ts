import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Temporary debug route — DELETE after testing
// Secured by x-debug-key header
export async function GET(req: NextRequest) {
  const key = req.headers.get('x-debug-key')
  if (key !== process.env.WEBHOOK_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientSecret = process.env.AZAMPAY_CLIENT_SECRET
  const clientId     = process.env.AZAMPAY_CLIENT_ID

  // Test Supabase admin client connectivity + subscriptions schema
  let supabaseTest: Record<string, unknown> = {}
  try {
    const admin = createAdminClient()

    // Check if subscriptions table is accessible
    const { data, error } = await admin
      .from('subscriptions')
      .select('id, plan, status, payment_method, payment_ref, amount_paid, starts_at')
      .limit(1)

    if (error) {
      supabaseTest = { ok: false, error: error.message, code: error.code }
    } else {
      supabaseTest = {
        ok: true,
        columns_visible: Object.keys(data?.[0] ?? {}).join(', ') || '(no rows)',
      }
    }

    // Try a test insert to catch constraint errors
    const testRef = `DEBUG-TEST-${Date.now()}`
    const { data: testInsert, error: testErr } = await admin
      .from('subscriptions')
      .insert({
        dalali_id:      '00000000-0000-0000-0000-000000000000',
        plan:           'basic',
        status:         'pending',
        amount_paid:    10000,
        payment_method: 'Mpesa',
        payment_ref:    testRef,
        starts_at:      new Date().toISOString(),
        expires_at:     new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .select('id')
      .single()

    if (testErr) {
      supabaseTest.insert_test = {
        ok: false,
        error:   testErr.message,
        code:    testErr.code,
        details: testErr.details,
        hint:    testErr.hint,
      }
    } else {
      // Clean up test row immediately
      await admin.from('subscriptions').delete().eq('id', testInsert.id)
      supabaseTest.insert_test = { ok: true, message: 'Test insert + delete succeeded' }
    }

  } catch (e) {
    supabaseTest = { ok: false, exception: String(e) }
  }

  return Response.json({
    env: {
      appName:       process.env.AZAMPAY_APP_NAME      ? 'SET' : 'MISSING',
      clientId:      clientId     ? `SET (starts: ${clientId.slice(0, 8)}...)` : 'MISSING',
      clientSecret:  clientSecret ? `SET (len=${clientSecret.length})` : 'MISSING',
      apiKey:        process.env.AZAMPAY_API_KEY        ? 'SET' : 'MISSING',
      environment:   process.env.AZAMPAY_ENVIRONMENT   ?? 'NOT SET',
      appUrl:        process.env.NEXT_PUBLIC_APP_URL   ?? 'NOT SET',
      supabaseUrl:   process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      serviceKey:    process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      mock:          process.env.AZAMPAY_MOCK           ?? 'NOT SET (production mode)',
    },
    supabase: supabaseTest,
  })
}
