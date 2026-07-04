import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth() + 1))
  const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()))

  const admin = createAdminClient()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd   = new Date(year, month, 1).toISOString().split('T')[0]

  const [incRes, expRes, commRes, userRes] = await Promise.all([
    admin.from('dalali_income').select('*').eq('dalali_id', user.id).gte('date', monthStart).lt('date', monthEnd).order('date'),
    admin.from('dalali_expenses').select('*').eq('dalali_id', user.id).gte('date', monthStart).lt('date', monthEnd).order('date'),
    admin.from('dalali_commissions').select('*').eq('dalali_id', user.id).gte('created_at', monthStart).lt('created_at', monthEnd),
    admin.from('users').select('full_name').eq('id', user.id).single(),
  ])

  type IncomeRow    = { date: string; category: string; description: string | null; client_name: string | null; amount: number }
  type ExpenseRow   = { date: string; category: string; description: string | null; amount: number }
  type CommRow      = { client_name: string; property_title: string; expected_amount: number; paid_amount: number; status: string }

  const income:      IncomeRow[]  = incRes.data  ?? []
  const expenses:    ExpenseRow[] = expRes.data   ?? []
  const commissions: CommRow[]    = commRes.data  ?? []
  const dalaliName   = userRes.data?.full_name ?? 'Dalali'

  const totalIncome   = income.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  const profit        = totalIncome - totalExpenses

  const MONTHS = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

  const html = `<!DOCTYPE html>
<html lang="sw"><head><meta charset="UTF-8"><title>Ripoti ya Hesabu — ${MONTHS[month]} ${year}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;color:#1a1a18;padding:32px;font-size:13px;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a18;padding-bottom:16px;margin-bottom:24px}
.brand{font-size:22px;font-weight:bold;color:#1D9E75}.subtitle{color:#666;font-size:12px;margin-top:2px}
.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}
.summary-card{background:#f8f8f5;border-radius:8px;padding:14px;text-align:center}
.summary-label{font-size:10px;color:#666;margin-bottom:5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.summary-value{font-size:18px;font-weight:bold}.profit{color:#1D9E75}.loss{color:#A32D2D}
h2{font-size:12px;font-weight:700;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e5e0;text-transform:uppercase;letter-spacing:.5px;color:#666}
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}
th{background:#f8f8f5;text-align:left;padding:7px 10px;font-size:10px;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
td{padding:7px 10px;border-bottom:1px solid #f4f4f0}
.amount{text-align:right;font-weight:500;font-family:monospace}
.total-row{font-weight:700;background:#f8f8f5}
.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e5e0;font-size:11px;color:#999;text-align:center}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
.badge-paid{background:#EAF3DE;color:#1D9E75}
.badge-pending{background:#FAEEDA;color:#854F0B}
.badge-overdue{background:#FCEBEB;color:#A32D2D}
.badge-partial{background:#EEF0FF;color:#4A4EBD}
@media print{body{padding:16px}.header{page-break-after:avoid}}
</style></head><body>
<div class="header">
  <div><div class="brand">NyumbaFasta</div><div class="subtitle">Ripoti ya Hesabu — ${dalaliName}</div></div>
  <div style="text-align:right"><div style="font-weight:700;font-size:15px">${MONTHS[month]} ${year}</div><div style="color:#666;font-size:11px">Imetolewa: ${new Date().toLocaleDateString('sw-TZ', { day:'2-digit', month:'long', year:'numeric' })}</div></div>
</div>

<div class="summary-grid">
  <div class="summary-card"><div class="summary-label">Mapato yote</div><div class="summary-value profit">TSh ${totalIncome.toLocaleString()}</div></div>
  <div class="summary-card"><div class="summary-label">Matumizi yote</div><div class="summary-value loss">TSh ${totalExpenses.toLocaleString()}</div></div>
  <div class="summary-card"><div class="summary-label">Faida halisi</div><div class="summary-value ${profit >= 0 ? 'profit' : 'loss'}">TSh ${profit.toLocaleString()}</div></div>
</div>

<h2>Mapato (rekodi ${income.length})</h2>
<table><thead><tr><th>Tarehe</th><th>Aina</th><th>Maelezo</th><th>Mteja</th><th class="amount">Kiasi (TSh)</th></tr></thead><tbody>
${income.map(r => `<tr><td>${r.date}</td><td>${r.category}</td><td>${r.description ?? '-'}</td><td>${r.client_name ?? '-'}</td><td class="amount">${r.amount.toLocaleString()}</td></tr>`).join('')}
<tr class="total-row"><td colspan="4">JUMLA</td><td class="amount">${totalIncome.toLocaleString()}</td></tr>
</tbody></table>

<h2>Matumizi (rekodi ${expenses.length})</h2>
<table><thead><tr><th>Tarehe</th><th>Aina</th><th>Maelezo</th><th class="amount">Kiasi (TSh)</th></tr></thead><tbody>
${expenses.map(r => `<tr><td>${r.date}</td><td>${r.category}</td><td>${r.description ?? '-'}</td><td class="amount">${r.amount.toLocaleString()}</td></tr>`).join('')}
<tr class="total-row"><td colspan="3">JUMLA</td><td class="amount">${totalExpenses.toLocaleString()}</td></tr>
</tbody></table>

${commissions.length > 0 ? `
<h2>Commission (rekodi ${commissions.length})</h2>
<table><thead><tr><th>Mteja</th><th>Nyumba</th><th class="amount">Inayotarajiwa</th><th class="amount">Imelipwa</th><th>Hali</th></tr></thead><tbody>
${commissions.map(c => `<tr><td>${c.client_name}</td><td>${c.property_title}</td><td class="amount">${c.expected_amount.toLocaleString()}</td><td class="amount">${c.paid_amount.toLocaleString()}</td><td><span class="badge badge-${c.status}">${c.status === 'paid' ? 'Imelipwa' : c.status === 'pending' ? 'Inasubiri' : c.status === 'overdue' ? 'Imechelewa' : 'Sehemu'}</span></td></tr>`).join('')}
</tbody></table>` : ''}

<div class="footer">NyumbaFasta — nyumbafasta.co &nbsp;|&nbsp; Ripoti hii ni ya siri &nbsp;|&nbsp; ${dalaliName}</div>

<script>
// Auto-print when opened in new tab
window.onload = function() {
  setTimeout(function() { window.print() }, 400)
}
</script>
</body></html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
