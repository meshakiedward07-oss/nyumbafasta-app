import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/v1/dalali/invoices/:id — fetch invoice with items
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: invoice, error } = await admin
    .from('dalali_invoices')
    .select(`
      *, items:dalali_invoice_items(id, description, quantity, unit_price, amount, created_at)
    `)
    .eq('id', id)
    .eq('dalali_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  return NextResponse.json({ invoice })
}

// PATCH /api/v1/dalali/invoices/:id — update status or details
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['status', 'client_name', 'client_phone', 'client_email', 'due_date', 'notes', 'tax_tzs']
  const patch: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) patch[k] = body[k]

  // Recalculate total if tax changed
  if ('tax_tzs' in patch) {
    const admin  = createAdminClient()
    const { data: inv } = await admin.from('dalali_invoices').select('subtotal_tzs').eq('id', id).single()
    if (inv) patch.total_tzs = Number(inv.subtotal_tzs) + Number(patch.tax_tzs)
  }
  patch.updated_at = new Date().toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin.from('dalali_invoices')
    .update(patch).eq('id', id).eq('dalali_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, invoice: data })
}

// DELETE /api/v1/dalali/invoices/:id — only draft invoices can be deleted
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: inv } = await admin.from('dalali_invoices')
    .select('status').eq('id', id).eq('dalali_id', user.id).single()
  if (!inv) return NextResponse.json({ error: 'Haipatikani' }, { status: 404 })
  if (inv.status !== 'draft') {
    return NextResponse.json({ error: 'Inaweza kufutwa rasimu tu (draft)' }, { status: 400 })
  }

  const { error } = await admin.from('dalali_invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
