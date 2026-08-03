import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Valid payment types that can be refunded
const VALID_PAYMENT_TYPES = [
  'unlock',
  'subscription',
  'boost',
  'extra_listing',
  'org_subscription',
  'fundi_subscription',
] as const
type PaymentType = (typeof VALID_PAYMENT_TYPES)[number]

// ── Auth helper ────────────────────────────────────────────────────────────────
// Returns { userId } if admin/staff, or null on 401/403.
async function requireAdminOrStaff(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'superadmin', 'staff'].includes(profile.role)) {
    return NextResponse.json({ error: 'Ruhusa ya admin/staff inahitajika' }, { status: 403 })
  }

  return { userId: user.id }
}

// POST /api/v1/admin/payments/refund
// Records a manual refund entry.
// Body: { payment_ref, payment_type, amount_tzs, reason, notes? }
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrStaff()
    if (auth instanceof NextResponse) return auth

    const body = await req.json()
    const { payment_ref, payment_type, amount_tzs, reason, notes } = body as {
      payment_ref:  string
      payment_type: PaymentType
      amount_tzs:   number
      reason:       string
      notes?:       string
    }

    // Validate required fields
    if (!payment_ref || typeof payment_ref !== 'string') {
      return NextResponse.json({ error: 'payment_ref inahitajika' }, { status: 400 })
    }
    if (!payment_type || !(VALID_PAYMENT_TYPES as readonly string[]).includes(payment_type)) {
      return NextResponse.json({
        error: `payment_type lazima iwe moja ya: ${VALID_PAYMENT_TYPES.join(', ')}`,
      }, { status: 400 })
    }
    if (!amount_tzs || typeof amount_tzs !== 'number' || amount_tzs <= 0) {
      return NextResponse.json({ error: 'amount_tzs lazima iwe nambari chanya' }, { status: 400 })
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'reason inahitajika' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: refund, error: insertError } = await admin
      .from('payment_refunds')
      .insert({
        payment_ref:   payment_ref.trim(),
        payment_type,
        amount_tzs,
        reason:        reason.trim(),
        notes:         notes?.trim() ?? null,
        refunded_by:   auth.userId,
        refunded_at:   new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError || !refund) {
      console.error('[Admin/refund POST] insert failed:', insertError)
      return NextResponse.json({
        error: insertError?.message ?? 'Imeshindwa kurekodi rejareja',
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: refund.id })

  } catch (err) {
    console.error('[Admin/refund POST] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}

// GET /api/v1/admin/payments/refund?limit=50&offset=0&payment_type=<type>
// Lists all refund records (admin only). Supports pagination and optional type filter.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrStaff()
    if (auth instanceof NextResponse) return auth

    const searchParams = req.nextUrl.searchParams
    const limit        = Math.min(Number(searchParams.get('limit') ?? '50'), 200)
    const offset       = Math.max(Number(searchParams.get('offset') ?? '0'), 0)
    const paymentType  = searchParams.get('payment_type')

    if (paymentType && !(VALID_PAYMENT_TYPES as readonly string[]).includes(paymentType)) {
      return NextResponse.json({
        error: `payment_type si sahihi. Chaguo: ${VALID_PAYMENT_TYPES.join(', ')}`,
      }, { status: 400 })
    }

    const admin = createAdminClient()

    let query = admin
      .from('payment_refunds')
      .select('id, payment_ref, payment_type, amount_tzs, reason, notes, refunded_by, refunded_at', { count: 'exact' })
      .order('refunded_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (paymentType) {
      query = query.eq('payment_type', paymentType)
    }

    const { data, count, error } = await query

    if (error) {
      console.error('[Admin/refund GET] query failed:', error)
      return NextResponse.json({ error: 'Imeshindwa kupata orodha ya marejesho' }, { status: 500 })
    }

    return NextResponse.json({
      refunds: data ?? [],
      total:   count ?? 0,
      limit,
      offset,
    })

  } catch (err) {
    console.error('[Admin/refund GET] Unexpected error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
