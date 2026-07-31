import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrgFeatures, checkFeature } from '@/lib/subscription/featureGate'

type Params = { params: { id: string } }

// GET /api/v1/organizations/:id/reports/download?month=YYYY-MM
export async function GET(req: NextRequest, { params }: Params) {
  const { id: orgId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })

  const admin = createAdminClient()
  const [memberRes, profileRes] = await Promise.all([
    admin.from('organization_members').select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId).eq('user_id', user.id),
    admin.from('users').select('role').eq('id', user.id).single(),
  ])
  const isAdminStaff = ['admin', 'staff'].includes(profileRes.data?.role ?? '')
  if (!memberRes.count && !isAdminStaff) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

  if (!isAdminStaff) {
    const features = await getOrgFeatures(orgId)
    const gate = checkFeature(features, 'has_reports', 'Ripoti na Takwimu')
    if (!gate.ok) return NextResponse.json({ error: gate.error, upgrade_required: true }, { status: gate.status })
  }

  const monthParam  = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const [y, m]      = monthParam.split('-').map(Number)
  const monthStart  = `${y}-${String(m).padStart(2, '0')}-01`
  const monthEnd    = new Date(y, m, 1).toISOString().split('T')[0]
  const monthLabel  = monthParam.replace('-', '_')

  // Fetch all data in parallel
  const { data: orgRow } = await admin.from('organizations').select('name').eq('id', orgId).single()
  const orgName = orgRow?.name ?? 'Org'

  const { data: leasesData } = await admin.from('leases')
    .select('id, monthly_rent, unit:property_units(unit_number), tenant:users!tenant_id(full_name, phone), status, start_date, end_date')
    .eq('org_id', orgId).order('status')

  const allLeaseIds = (leasesData ?? []).map(l => l.id)

  const [paymentsRes, expensesRes, maintRes, unitsRes] = await Promise.all([
    allLeaseIds.length > 0
      ? admin.from('lease_payments')
          .select('lease_id, amount_due, amount_paid, due_date, status, late_fee_amount, paid_at')
          .gte('due_date', monthStart).lt('due_date', monthEnd)
          .in('lease_id', allLeaseIds).order('due_date')
      : Promise.resolve({ data: [] }),
    admin.from('org_expenses')
      .select('amount_tzs, category, description, vendor, expense_date, payment_method, receipt_url')
      .eq('organization_id', orgId).gte('expense_date', monthStart).lt('expense_date', monthEnd)
      .order('expense_date'),
    admin.from('maintenance_requests')
      .select('title, status, priority, actual_cost, created_at, unit:property_units(unit_number)')
      .eq('org_id', orgId)
      .gte('created_at', monthStart + 'T00:00:00').lt('created_at', monthEnd + 'T00:00:00')
      .order('created_at'),
    admin.from('property_units').select('unit_number, status, type, floor_number').eq('org_id', orgId).order('unit_number'),
  ])

  const payments = paymentsRes.data ?? []
  const expenses = expensesRes.data ?? []
  const maint    = maintRes.data ?? []
  const units    = unitsRes.data ?? []

  const totalCollected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount_paid ?? p.amount_due ?? 0), 0)
  const totalDue       = payments.reduce((s, p) => s + (p.amount_due ?? 0), 0)
  const totalExpenses  = expenses.reduce((s, e) => s + Number(e.amount_tzs ?? 0), 0)
  const net            = totalCollected - totalExpenses

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'NyumbaFasta'
  wb.created = new Date()

  const GREEN  = { argb: 'FF1D9E75' } as const
  const WHITE  = { argb: 'FFFFFFFF' } as const
  const LGREEN = { argb: 'FFdcfce7' } as const
  const LRED   = { argb: 'FFfee2e2' } as const
  const LGRAY  = { argb: 'FFf9fafb' } as const

  function headerRow(ws: ReturnType<typeof wb.addWorksheet>) {
    const row = ws.getRow(1)
    row.font   = { bold: true, color: WHITE }
    row.fill   = { type: 'pattern', pattern: 'solid', fgColor: GREEN }
    row.height = 20
    ws.getRow(1).alignment = { vertical: 'middle' }
  }

  // ── Sheet 1: Muhtasari ───────────────────────────────────────────────────
  const sumWs = wb.addWorksheet('Muhtasari')
  sumWs.columns = [
    { header: 'Kipengele', key: 'label', width: 35 },
    { header: 'Kiasi (TZS)', key: 'value', width: 22 },
  ]
  headerRow(sumWs)
  const sumRows = [
    { label: 'Shirika', value: orgName },
    { label: 'Kipindi', value: monthParam },
    { label: '', value: '' },
    { label: '── MAPATO ──', value: '' },
    { label: 'Kodi Inayotarajiwa', value: totalDue },
    { label: 'Kodi Iliyokusanywa', value: totalCollected },
    { label: 'Asilimia ya Ukusanyaji', value: totalDue > 0 ? `${Math.round((totalCollected / totalDue) * 100)}%` : '0%' },
    { label: '', value: '' },
    { label: '── MATUMIZI ──', value: '' },
    { label: 'Jumla ya Matumizi', value: totalExpenses },
    { label: '', value: '' },
    { label: net >= 0 ? '✅ FAIDA (Mapato - Matumizi)' : '❌ HASARA (Mapato - Matumizi)', value: net },
    { label: 'Idadi ya Vitengo', value: units.length },
    { label: 'Vitengo Vilivyokaliwa', value: units.filter(u => u.status === 'occupied').length },
  ]
  sumRows.forEach(r => {
    const row = sumWs.addRow(r)
    if (String(r.label).includes('FAIDA') || String(r.label).includes('HASARA')) {
      row.font = { bold: true }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: net >= 0 ? LGREEN : LRED }
    } else if (String(r.label).startsWith('──')) {
      row.font = { bold: true }
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: LGRAY }
    }
  })

  // ── Sheet 2: Malipo ya Kodi ──────────────────────────────────────────────
  const payWs = wb.addWorksheet('Malipo ya Kodi')
  payWs.columns = [
    { header: 'Tarehe',       key: 'due_date',  width: 14 },
    { header: 'Kitengo',      key: 'unit',      width: 12 },
    { header: 'Mpangaji',     key: 'tenant',    width: 24 },
    { header: 'Inayotarajiwa',key: 'due',       width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Iliyolipwa',   key: 'paid',      width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Adhabu',       key: 'late_fee',  width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'Hali',         key: 'status',    width: 12 },
    { header: 'Tarehe Lipwa', key: 'paid_at',   width: 16 },
  ]
  headerRow(payWs)
  const leaseMap = new Map((leasesData ?? []).map(l => [l.id, l]))
  for (const p of payments) {
    const lease  = leaseMap.get(p.lease_id)
    const unit   = (lease?.unit as { unit_number?: string } | null)?.unit_number ?? '—'
    const tenant = (lease?.tenant as { full_name?: string } | null)?.full_name ?? '—'
    payWs.addRow({
      due_date: p.due_date,
      unit,
      tenant,
      due:      p.amount_due,
      paid:     p.status === 'paid' ? (p.amount_paid ?? p.amount_due) : 0,
      late_fee: p.late_fee_amount ?? 0,
      status:   p.status === 'paid' ? 'Imelipwa' : p.status === 'late' ? 'Imechelewa' : 'Inasubiri',
      paid_at:  p.paid_at ? p.paid_at.split('T')[0] : '—',
    })
  }
  const payTotal = payWs.addRow({ due_date: 'JUMLA', due: totalDue, paid: totalCollected })
  payTotal.font = { bold: true }
  payTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: LGREEN }

  // ── Sheet 3: Matumizi ────────────────────────────────────────────────────
  const expWs = wb.addWorksheet('Matumizi')
  expWs.columns = [
    { header: 'Tarehe',    key: 'date',    width: 14 },
    { header: 'Aina',      key: 'category',width: 16 },
    { header: 'Maelezo',   key: 'desc',    width: 36 },
    { header: 'Muuzaji',   key: 'vendor',  width: 20 },
    { header: 'Kiasi (TZS)',key: 'amount', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Njia',      key: 'method',  width: 14 },
  ]
  headerRow(expWs)
  for (const e of expenses) {
    expWs.addRow({
      date:     e.expense_date,
      category: e.category,
      desc:     e.description,
      vendor:   e.vendor ?? '—',
      amount:   Number(e.amount_tzs),
      method:   e.payment_method ?? 'cash',
    })
  }
  const expTotal = expWs.addRow({ date: 'JUMLA', amount: totalExpenses })
  expTotal.font = { bold: true }
  expTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: LRED }

  // ── Sheet 4: Matengenezo ─────────────────────────────────────────────────
  if (maint.length > 0) {
    const maintWs = wb.addWorksheet('Matengenezo')
    maintWs.columns = [
      { header: 'Tarehe',      key: 'date',      width: 14 },
      { header: 'Kitengo',     key: 'unit',      width: 12 },
      { header: 'Maelezo',     key: 'title',     width: 36 },
      { header: 'Kipaumbele',  key: 'priority',  width: 14 },
      { header: 'Hali',        key: 'status',    width: 14 },
      { header: 'Gharama (TZS)',key: 'cost',     width: 18, style: { numFmt: '#,##0.00' } },
    ]
    headerRow(maintWs)
    for (const mr of maint) {
      maintWs.addRow({
        date:     mr.created_at?.split('T')[0],
        unit:     (mr.unit as { unit_number?: string } | null)?.unit_number ?? '—',
        title:    mr.title,
        priority: mr.priority,
        status:   mr.status,
        cost:     mr.actual_cost ?? 0,
      })
    }
  }

  // ── Sheet 5: Vitengo ─────────────────────────────────────────────────────
  const unitWs = wb.addWorksheet('Vitengo')
  unitWs.columns = [
    { header: 'Kitengo',  key: 'unit',   width: 14 },
    { header: 'Aina',     key: 'type',   width: 14 },
    { header: 'Ghorofa',  key: 'floor',  width: 10 },
    { header: 'Hali',     key: 'status', width: 14 },
  ]
  headerRow(unitWs)
  for (const u of units) {
    unitWs.addRow({ unit: u.unit_number, type: u.type, floor: u.floor_number, status: u.status })
  }

  const buf = await wb.xlsx.writeBuffer()
  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="taarifa_${orgName.replace(/\s+/g,'_')}_${monthLabel}.xlsx"`,
    },
  })
}
