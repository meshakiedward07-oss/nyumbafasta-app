import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET /api/v1/dalali/finance/export?month=YYYY-MM&year=YYYY
export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const now   = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const year  = parseInt(searchParams.get('year')  ?? String(now.getFullYear()))

  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd   = new Date(year, month, 1).toISOString().split('T')[0]

  const admin = createAdminClient()
  const id    = user.id

  const [incomeRes, expenseRes, commRes, billingRes, unlockRes] = await Promise.all([
    admin.from('dalali_income')
      .select('id, amount, category, date, description, client_name, listing_title, payment_method')
      .eq('dalali_id', id).gte('date', monthStart).lt('date', monthEnd)
      .order('date', { ascending: false }),

    admin.from('dalali_expenses')
      .select('id, amount, category, date, description, vendor, payment_method, receipt_url')
      .eq('dalali_id', id).gte('date', monthStart).lt('date', monthEnd)
      .order('date', { ascending: false }),

    admin.from('dalali_commissions')
      .select('id, client_name, property_title, expected_amount, paid_amount, status, due_date, created_at')
      .eq('dalali_id', id).order('created_at', { ascending: false }).limit(100),

    admin.from('subscription_invoices')
      .select('id, amount, status, created_at, period_start, period_end, plan_name')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(24),

    admin.from('contact_unlocks')
      .select('id, amount_paid, created_at')
      .eq('dalali_id', id).eq('status', 'completed')
      .gte('created_at', monthStart + 'T00:00:00').lt('created_at', monthEnd + 'T00:00:00'),
  ])

  const income   = incomeRes.data   ?? []
  const expenses = expenseRes.data  ?? []
  const comms    = commRes.data     ?? []
  const billing  = billingRes.data  ?? []
  const unlocks  = unlockRes.data   ?? []

  const totalIncome   = income.reduce((s, r) => s + (r.amount ?? 0), 0)
  const totalExpenses = expenses.reduce((s, r) => s + (r.amount ?? 0), 0)
  const net           = totalIncome - totalExpenses

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NyumbaFasta'
  wb.created = new Date()

  const GREEN  = { argb: 'FF1D9E75' } as const
  const WHITE  = { argb: 'FFFFFFFF' } as const
  const LGREEN = { argb: 'FFdcfce7' } as const
  const LRED   = { argb: 'FFfee2e2' } as const

  function hdr(ws: ReturnType<typeof wb.addWorksheet>) {
    const row = ws.getRow(1)
    row.font   = { bold: true, color: WHITE }
    row.fill   = { type: 'pattern', pattern: 'solid', fgColor: GREEN }
    row.height = 20
  }

  // ── Sheet 1: Muhtasari ───────────────────────────────────────────────────
  const sumWs = wb.addWorksheet('Muhtasari')
  sumWs.columns = [
    { header: 'Kipengele', key: 'label', width: 34 },
    { header: 'Kiasi (TZS)', key: 'value', width: 22 },
  ]
  hdr(sumWs)
  const MONTHS_SW = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']
  const sumData = [
    { label: 'Kipindi', value: `${MONTHS_SW[month - 1]} ${year}` },
    { label: '', value: '' },
    { label: 'Jumla ya Mapato',       value: totalIncome },
    { label: 'Jumla ya Matumizi',     value: totalExpenses },
    { label: net >= 0 ? '✅ Faida' : '❌ Hasara', value: net },
    { label: '', value: '' },
    { label: 'Miamala ya Mapato',     value: income.length },
    { label: 'Miamala ya Matumizi',   value: expenses.length },
    { label: 'Contact Unlocks',       value: unlocks.length },
    { label: 'Thamani ya Unlocks',    value: unlocks.reduce((s, u) => s + (u.amount_paid ?? 0), 0) },
  ]
  sumData.forEach(r => {
    const row = sumWs.addRow(r)
    if (String(r.label).includes('Faida') || String(r.label).includes('Hasara')) {
      row.font = { bold: true }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: net >= 0 ? LGREEN : LRED }
    }
  })

  // ── Sheet 2: Mapato ──────────────────────────────────────────────────────
  const incWs = wb.addWorksheet('Mapato')
  incWs.columns = [
    { header: 'Tarehe',        key: 'date',    width: 14 },
    { header: 'Aina',          key: 'category',width: 18 },
    { header: 'Maelezo',       key: 'desc',    width: 32 },
    { header: 'Mteja',         key: 'client',  width: 22 },
    { header: 'Kiasi (TZS)',   key: 'amount',  width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Njia',          key: 'method',  width: 14 },
  ]
  hdr(incWs)
  income.forEach(r => {
    incWs.addRow({ date: r.date, category: r.category, desc: r.description, client: r.client_name ?? '—', amount: r.amount, method: r.payment_method ?? '—' })
  })
  const incTot = incWs.addRow({ date: 'JUMLA', amount: totalIncome })
  incTot.font = { bold: true }
  incTot.fill = { type: 'pattern', pattern: 'solid', fgColor: LGREEN }

  // ── Sheet 3: Matumizi ─────────────────────────────────────────────────────
  const expWs = wb.addWorksheet('Matumizi')
  expWs.columns = [
    { header: 'Tarehe',      key: 'date',    width: 14 },
    { header: 'Aina',        key: 'category',width: 18 },
    { header: 'Maelezo',     key: 'desc',    width: 32 },
    { header: 'Muuzaji',     key: 'vendor',  width: 22 },
    { header: 'Kiasi (TZS)', key: 'amount',  width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Njia',        key: 'method',  width: 14 },
    { header: 'Risiti URL',  key: 'receipt', width: 30 },
  ]
  hdr(expWs)
  expenses.forEach(r => {
    expWs.addRow({ date: r.date, category: r.category, desc: r.description, vendor: r.vendor ?? '—', amount: r.amount, method: r.payment_method ?? '—', receipt: r.receipt_url ?? '' })
  })
  const expTot = expWs.addRow({ date: 'JUMLA', amount: totalExpenses })
  expTot.font = { bold: true }
  expTot.fill = { type: 'pattern', pattern: 'solid', fgColor: LRED }

  // ── Sheet 4: Kamisheni ────────────────────────────────────────────────────
  const commWs = wb.addWorksheet('Kamisheni')
  commWs.columns = [
    { header: 'Tarehe',         key: 'date',     width: 14 },
    { header: 'Mteja',          key: 'client',   width: 24 },
    { header: 'Nyumba',         key: 'prop',     width: 28 },
    { header: 'Inayotarajiwa',  key: 'expected', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Iliyolipwa',     key: 'paid',     width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Hali',           key: 'status',   width: 12 },
    { header: 'Mwisho',         key: 'due',      width: 14 },
  ]
  hdr(commWs)
  comms.forEach(r => {
    const status = r.status === 'paid' ? 'Imelipwa' : r.status === 'overdue' ? 'Imechelewa' : 'Inasubiri'
    commWs.addRow({ date: r.created_at?.split('T')[0], client: r.client_name, prop: r.property_title, expected: r.expected_amount, paid: r.paid_amount, status, due: r.due_date ?? '—' })
  })

  // ── Sheet 5: Bili ya Subscription ─────────────────────────────────────────
  if (billing.length > 0) {
    const billWs = wb.addWorksheet('Bili ya Subscription')
    billWs.columns = [
      { header: 'Tarehe',     key: 'date',   width: 14 },
      { header: 'Mpango',     key: 'plan',   width: 16 },
      { header: 'Kipindi',    key: 'period', width: 24 },
      { header: 'Kiasi',      key: 'amount', width: 16, style: { numFmt: '#,##0.00' } },
      { header: 'Hali',       key: 'status', width: 12 },
    ]
    hdr(billWs)
    billing.forEach(r => {
      const period = r.period_start && r.period_end ? `${r.period_start} — ${r.period_end}` : '—'
      billWs.addRow({ date: r.created_at?.split('T')[0], plan: r.plan_name ?? '—', period, amount: r.amount, status: r.status })
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  const label = `${MONTHS_SW[month - 1]}_${year}`
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="hesabu_dalali_${label}.xlsx"`,
    },
  })
}
