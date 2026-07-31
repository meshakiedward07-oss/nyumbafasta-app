import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// GET /api/v1/dalali/invoices?status=draft|sent|paid|cancelled
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin      = createAdminClient()
  const status     = req.nextUrl.searchParams.get('status')
  let query = admin
    .from('dalali_invoices')
    .select(`
      id, invoice_number, client_name, client_phone, client_email,
      issue_date, due_date, status, subtotal_tzs, tax_tzs, total_tzs,
      notes, created_at, updated_at
    `)
    .eq('dalali_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}

// POST /api/v1/dalali/invoices
// Body: { client_name, client_phone?, client_email?, due_date?, notes?, items: [{description, quantity, unit_price}] }
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { client_name, client_phone, client_email, due_date, notes, items = [] } = body

  if (!client_name) return NextResponse.json({ error: 'client_name inahitajika' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Lazima uwe na angalau kitu kimoja (items)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Generate invoice number
  const { data: numRow } = await admin.rpc('next_dalali_invoice_number', { p_dalali_id: user.id })
  const invoiceNumber = (numRow as string | null) ?? `INV-${Date.now()}`

  const subtotal = (items as { quantity: number; unit_price: number }[])
    .reduce((s, it) => s + (Number(it.quantity) * Number(it.unit_price)), 0)
  const tax_tzs   = 0 // dalali manages tax manually for now
  const total_tzs = subtotal + tax_tzs

  const { data: invoice, error: invErr } = await admin.from('dalali_invoices').insert({
    dalali_id:      user.id,
    invoice_number: invoiceNumber,
    client_name:    String(client_name).slice(0, 200),
    client_phone:   client_phone ? String(client_phone).slice(0, 20) : null,
    client_email:   client_email ? String(client_email).slice(0, 200) : null,
    issue_date:     new Date().toISOString().split('T')[0],
    due_date:       due_date ?? null,
    status:         'draft',
    subtotal_tzs:   subtotal,
    tax_tzs,
    total_tzs,
    notes:          notes ? String(notes).slice(0, 1000) : null,
  }).select().single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 })

  const itemRows = items.map((it: { description: string; quantity: number; unit_price: number }) => ({
    invoice_id:  invoice.id,
    description: String(it.description).slice(0, 500),
    quantity:    Number(it.quantity),
    unit_price:  Number(it.unit_price),
  }))

  const { error: itemErr } = await admin.from('dalali_invoice_items').insert(itemRows)
  if (itemErr) {
    // Rollback invoice
    await admin.from('dalali_invoices').delete().eq('id', invoice.id)
    return NextResponse.json({ error: itemErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, invoice }, { status: 201 })
}
