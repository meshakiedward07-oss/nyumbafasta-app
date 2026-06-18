import { getIncomeSummary, getDateRange } from './incomeTracker'
import { getExpenseSummary } from './expenseTracker'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ── Source / category display names ──────────────────────────────────────
export function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    subscription:    'Subscription ya Dalali',
    contact_unlock:  'Contact Unlock (TZS 2,000)',
    boost_listing:   'Boost Listing',
    extra_listing:   'Listing ya Ziada',
    other:           'Mengine',
  }
  return names[source] || source
}

export function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    hosting:   'Hosting',
    api_costs: 'API Costs',
    marketing: 'Masoko',
    legal:     'Kisheria',
    staff:     'Wafanyakazi',
    software:  'Programu',
    banking:   'Benki',
    other:     'Mengine',
  }
  return names[category] || category
}

// ── Generate financial summary ─────────────────────────────────────────────
export async function generateFinancialSummary(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date?:  Date
}) {
  const [income, expenses] = await Promise.all([
    getIncomeSummary(params),
    getExpenseSummary(params),
  ])

  const profit       = income.netIncome - expenses.total
  const profitMargin = income.total > 0 ? (profit / income.total) * 100 : 0

  return {
    period: params.period,
    income,
    expenses,
    profit,
    profitMargin: parseFloat(profitMargin.toFixed(2)),
  }
}

// ── Format TZS ───────────────────────────────────────────────────────────
function fmtTZS(amount: number): string {
  return `TZS ${amount.toLocaleString('en-TZ', { minimumFractionDigits: 2 })}`
}

// ── Generate PDF report (HTML → Puppeteer) ────────────────────────────────
// NOTE: In production on Vercel, replace puppeteer with @sparticuz/chromium + puppeteer-core.
export async function generatePDFReport(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date?:  Date
}): Promise<Buffer> {
  const summary = await generateFinancialSummary(params)
  const date    = params.date ?? new Date()

  const periodLabel =
    params.period === 'daily'   ? date.toLocaleDateString('sw-TZ')
    : params.period === 'weekly'  ? `Wiki ya ${date.toLocaleDateString('sw-TZ')}`
    : params.period === 'yearly'  ? `Mwaka ${date.getFullYear()}`
    : date.toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' })

  const incomeRows = Object.entries(summary.income.bySource)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([source, amt]) => {
      const pct = summary.income.total > 0
        ? (((amt as number) / summary.income.total) * 100).toFixed(1)
        : '0.0'
      return `<tr>
        <td>${formatSourceName(source)}</td>
        <td style="text-align:right">${fmtTZS(amt as number)}</td>
        <td style="text-align:right">${pct}%</td>
      </tr>`
    }).join('')

  const expenseRows = Object.entries(summary.expenses.byCategory)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([cat, amt]) => {
      const pct = summary.expenses.total > 0
        ? (((amt as number) / summary.expenses.total) * 100).toFixed(1)
        : '0.0'
      return `<tr>
        <td>${formatCategoryName(cat)}</td>
        <td style="text-align:right">${fmtTZS(amt as number)}</td>
        <td style="text-align:right">${pct}%</td>
      </tr>`
    }).join('')

  const methodRows = Object.entries(summary.income.byMethod)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([m, amt]) => `<tr>
      <td>${m.toUpperCase()}</td>
      <td style="text-align:right">${fmtTZS(amt as number)}</td>
    </tr>`).join('')

  const profitColor = summary.profit >= 0 ? '#16a34a' : '#dc2626'
  const profitBg    = summary.profit >= 0 ? '#dcfce7' : '#fee2e2'

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; font-size: 13px; }
  .header { text-align: center; margin-bottom: 28px; }
  .logo { font-size: 22px; font-weight: bold; color: #16a34a; }
  h2 { color: #16a34a; border-bottom: 2px solid #16a34a; padding-bottom: 6px; margin-top: 24px; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 18px 0; }
  .card { background: #f9fafb; border-radius: 8px; padding: 14px; text-align: center; }
  .card.profit { background: ${profitBg}; }
  .card-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .card-value { font-size: 18px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { background: #16a34a; color: #fff; padding: 8px 10px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .total-row td { font-weight: bold; background: #f0fdf4 !important; }
  .profit-box { background: ${profitBg}; border-radius: 8px; padding: 18px; text-align: center; margin: 18px 0; }
  .profit-value { font-size: 28px; font-weight: bold; color: ${profitColor}; }
  .footer { text-align: center; margin-top: 36px; font-size: 10px; color: #9ca3af; }
</style></head><body>

<div class="header">
  <div class="logo">🏠 NyumbaFasta</div>
  <div style="color:#6b7280;font-size:11px">Haraka &amp; Kwa Uhakika — nyumbafasta.co</div>
  <h1 style="margin:12px 0 4px;font-size:18px">Ripoti ya Fedha</h1>
  <p style="color:#6b7280;margin:0;font-size:12px">${periodLabel} &nbsp;|&nbsp; Ilizalishwa: ${new Date().toLocaleString('sw-TZ')}</p>
</div>

<div class="cards">
  <div class="card">
    <div class="card-label">Jumla ya Mapato</div>
    <div class="card-value" style="color:#16a34a">${fmtTZS(summary.income.total)}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:3px">Miamala: ${summary.income.transactionCount}</div>
  </div>
  <div class="card">
    <div class="card-label">Jumla ya Matumizi</div>
    <div class="card-value" style="color:#dc2626">${fmtTZS(summary.expenses.total)}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:3px">Malipo: ${summary.expenses.expenseCount}</div>
  </div>
  <div class="card profit">
    <div class="card-label">${summary.profit >= 0 ? 'Faida' : 'Hasara'}</div>
    <div class="card-value" style="color:${profitColor}">${fmtTZS(Math.abs(summary.profit))}</div>
    <div style="font-size:10px;color:#6b7280;margin-top:3px">Asilimia: ${summary.profitMargin}%</div>
  </div>
</div>

<h2>📈 Mapato kwa Chanzo</h2>
<table>
  <thead><tr><th>Chanzo</th><th style="text-align:right">Kiasi (TZS)</th><th style="text-align:right">%</th></tr></thead>
  <tbody>
    ${incomeRows || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">Hakuna mapato kipindi hiki</td></tr>'}
    <tr class="total-row"><td>JUMLA</td><td style="text-align:right">${fmtTZS(summary.income.total)}</td><td style="text-align:right">100%</td></tr>
  </tbody>
</table>
<p style="font-size:11px;color:#6b7280">* Ada ya AzamPay (1%): ${fmtTZS(summary.income.platformFees)} &nbsp;|&nbsp; Mapato halisi: ${fmtTZS(summary.income.netIncome)}</p>

<h2>📉 Matumizi kwa Aina</h2>
<table>
  <thead><tr><th>Aina</th><th style="text-align:right">Kiasi (TZS)</th><th style="text-align:right">%</th></tr></thead>
  <tbody>
    ${expenseRows || '<tr><td colspan="3" style="text-align:center;color:#9ca3af">Hakuna matumizi kipindi hiki</td></tr>'}
    <tr class="total-row"><td>JUMLA</td><td style="text-align:right">${fmtTZS(summary.expenses.total)}</td><td style="text-align:right">100%</td></tr>
  </tbody>
</table>

${methodRows ? `<h2>💳 Mapato kwa Njia ya Malipo</h2>
<table>
  <thead><tr><th>Njia</th><th style="text-align:right">Kiasi (TZS)</th></tr></thead>
  <tbody>${methodRows}</tbody>
</table>` : ''}

<div class="profit-box">
  <div style="font-size:12px;color:#6b7280">${summary.profit >= 0 ? '✅ FAIDA YA KIPINDI HIKI' : '❌ HASARA YA KIPINDI HIKI'}</div>
  <div class="profit-value">${summary.profit >= 0 ? '+' : '-'}${fmtTZS(Math.abs(summary.profit))}</div>
  <div style="font-size:12px;color:#6b7280;margin-top:4px">Asilimia ya Faida: ${summary.profitMargin}%</div>
</div>

<div class="footer">
  <p>Ripoti hii imezalishwa automatically na mfumo wa NyumbaFasta</p>
  <p>© ${new Date().getFullYear()} NyumbaFasta Tanzania — nyumbafasta.co</p>
</div>
</body></html>`

  const puppeteer = await import('puppeteer')
  const browser   = await puppeteer.default.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page      = await browser.newPage()
  await page.setContent(html, { waitUntil: 'domcontentloaded' })
  const pdf = await page.pdf({
    format:          'A4',
    printBackground: true,
    margin:          { top: '15mm', bottom: '15mm', left: '12mm', right: '12mm' },
  })
  await browser.close()
  return Buffer.from(pdf)
}

// ── Generate Excel report (3 sheets) ─────────────────────────────────────
export async function generateExcelReport(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date?:  Date
}): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default
  const wb      = new ExcelJS.Workbook()
  wb.creator    = 'NyumbaFasta'
  wb.created    = new Date()

  const summary   = await generateFinancialSummary(params)
  const { startDate, endDate } = getDateRange(params.period, params.date ?? new Date())

  const GREEN  = { argb: 'FF16a34a' } as const
  const WHITE  = { argb: 'FFFFFFFF' } as const
  const LGREEN = { argb: 'FFdcfce7' } as const
  const LRED   = { argb: 'FFfee2e2' } as const

  function styleHeader(ws: InstanceType<typeof ExcelJS.Workbook>['addWorksheet'] extends (n: string) => infer R ? R : never) {
    const row = ws.getRow(1)
    row.font = { bold: true, color: WHITE }
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: GREEN }
    row.height = 20
  }

  // ── Sheet 1: Muhtasari ────────────────────────────────────────────────
  const sumSheet = wb.addWorksheet('Muhtasari')
  sumSheet.columns = [
    { header: 'Kipengele', key: 'label', width: 35 },
    { header: 'Kiasi (TZS)', key: 'value', width: 22 },
  ]
  styleHeader(sumSheet)

  const sumData = [
    { label: '── MAPATO ──', value: '' },
    { label: 'Jumla ya Mapato', value: summary.income.total },
    { label: 'Ada ya AzamPay (1%)', value: -summary.income.platformFees },
    { label: 'Mapato Halisi', value: summary.income.netIncome },
    { label: '', value: '' },
    ...Object.entries(summary.income.bySource).map(([s, v]) => ({ label: `  ${formatSourceName(s)}`, value: v })),
    { label: '', value: '' },
    { label: '── MATUMIZI ──', value: '' },
    { label: 'Jumla ya Matumizi', value: summary.expenses.total },
    { label: '', value: '' },
    ...Object.entries(summary.expenses.byCategory).map(([c, v]) => ({ label: `  ${formatCategoryName(c)}`, value: v })),
    { label: '', value: '' },
    { label: summary.profit >= 0 ? '✅ FAIDA' : '❌ HASARA', value: summary.profit },
    { label: 'Asilimia ya Faida', value: `${summary.profitMargin}%` },
  ]

  sumData.forEach(row => {
    const r = sumSheet.addRow(row)
    if (row.label.includes('FAIDA') || row.label.includes('HASARA')) {
      r.font = { bold: true }
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: summary.profit >= 0 ? LGREEN : LRED }
    }
  })

  // ── Sheet 2: Mapato ──────────────────────────────────────────────────
  const incSheet = wb.addWorksheet('Mapato')
  incSheet.columns = [
    { header: 'Tarehe',        key: 'date',   width: 14 },
    { header: 'Chanzo',        key: 'source', width: 28 },
    { header: 'Maelezo',       key: 'desc',   width: 32 },
    { header: 'Kiasi (TZS)',   key: 'amount', width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Ada Platform',  key: 'fee',    width: 16, style: { numFmt: '#,##0.00' } },
    { header: 'Kiasi Halisi',  key: 'net',    width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'Njia ya Malipo',key: 'method', width: 16 },
    { header: 'Rejeo',         key: 'ref',    width: 28 },
  ]
  styleHeader(incSheet)

  const { data: incRows } = await supabaseAdmin
    .from('income_records')
    .select('*')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .eq('status', 'confirmed')
    .order('transaction_date', { ascending: false })

  incRows?.forEach(r => {
    incSheet.addRow({
      date:   r.transaction_date,
      source: formatSourceName(r.source),
      desc:   r.description ?? '',
      amount: Number(r.amount_tzs),
      fee:    Number(r.platform_fee_tzs),
      net:    Number(r.net_amount_tzs),
      method: r.payment_method?.toUpperCase() ?? 'N/A',
      ref:    r.reference_number ?? '',
    })
  })

  const incTotal = incSheet.addRow({
    date: 'JUMLA', amount: summary.income.total,
    fee: summary.income.platformFees, net: summary.income.netIncome,
  })
  incTotal.font = { bold: true }
  incTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: LGREEN }

  // ── Sheet 3: Matumizi ────────────────────────────────────────────────
  const expSheet = wb.addWorksheet('Matumizi')
  expSheet.columns = [
    { header: 'Tarehe',         key: 'date',      width: 14 },
    { header: 'Aina',           key: 'category',  width: 16 },
    { header: 'Maalum',         key: 'sub',       width: 16 },
    { header: 'Maelezo',        key: 'desc',      width: 32 },
    { header: 'Muuzaji',        key: 'vendor',    width: 18 },
    { header: 'Kiasi (TZS)',    key: 'amount',    width: 18, style: { numFmt: '#,##0.00' } },
    { header: 'USD',            key: 'usd',       width: 10 },
    { header: 'Njia',           key: 'method',    width: 14 },
    { header: 'Mara kwa Mara?', key: 'recurring', width: 14 },
  ]
  styleHeader(expSheet)

  const { data: expRows } = await supabaseAdmin
    .from('expense_records')
    .select('*')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)
    .eq('status', 'paid')
    .order('expense_date', { ascending: false })

  expRows?.forEach(r => {
    expSheet.addRow({
      date:      r.expense_date,
      category:  formatCategoryName(r.category),
      sub:       r.subcategory ?? '',
      desc:      r.description,
      vendor:    r.vendor ?? 'N/A',
      amount:    Number(r.amount_tzs),
      usd:       r.amount_usd ? `$${r.amount_usd}` : '',
      method:    r.payment_method ?? 'N/A',
      recurring: r.is_recurring ? 'Ndiyo' : 'Hapana',
    })
  })

  const expTotal = expSheet.addRow({ date: 'JUMLA', amount: summary.expenses.total })
  expTotal.font = { bold: true }
  expTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: LRED }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
