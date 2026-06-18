import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { getDateRange } from './incomeTracker'

// ── Week number helper ────────────────────────────────────────────────────
function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
}

// ── Add expense record ─────────────────────────────────────────────────────
export async function addExpense(params: {
  category:        string
  subcategory?:    string
  description:     string
  vendor?:         string
  amountTzs:       number
  amountUsd?:      number
  exchangeRate?:   number
  paymentMethod?:  string
  expenseDate:     string  // YYYY-MM-DD
  isRecurring?:    boolean
  recurringPeriod?: string
  receiptUrl?:     string
  addedBy?:        string
  status?:         string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const d = new Date(params.expenseDate)

    const { data, error } = await supabaseAdmin
      .from('expense_records')
      .insert({
        category:        params.category,
        subcategory:     params.subcategory,
        description:     params.description,
        vendor:          params.vendor,
        amount_tzs:      params.amountTzs,
        amount_usd:      params.amountUsd,
        exchange_rate:   params.exchangeRate,
        payment_method:  params.paymentMethod,
        expense_date:    params.expenseDate,
        month:           d.getMonth() + 1,
        year:            d.getFullYear(),
        week:            getWeekNumber(d),
        is_recurring:    params.isRecurring ?? false,
        recurring_period: params.recurringPeriod,
        receipt_url:     params.receiptUrl,
        added_by:        params.addedBy,
        status:          params.status ?? 'paid',
      })
      .select('id')
      .single()

    if (error) throw error

    console.log('[Accounting] Expense added:', params.description, 'TZS', params.amountTzs)
    return { success: true, id: data.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting] addExpense error:', msg)
    return { success: false, error: msg }
  }
}

// ── Update expense record ─────────────────────────────────────────────────
export async function updateExpense(
  id: string,
  updates: Partial<{
    category:        string
    subcategory:     string
    description:     string
    vendor:          string
    amountTzs:       number
    amountUsd:       number
    exchangeRate:    number
    paymentMethod:   string
    expenseDate:     string
    isRecurring:     boolean
    recurringPeriod: string
    receiptUrl:      string
    status:          string
  }>,
): Promise<{ success: boolean; error?: string }> {
  const dbUpdates: Record<string, unknown> = {}
  if (updates.category       !== undefined) dbUpdates.category        = updates.category
  if (updates.subcategory    !== undefined) dbUpdates.subcategory     = updates.subcategory
  if (updates.description    !== undefined) dbUpdates.description     = updates.description
  if (updates.vendor         !== undefined) dbUpdates.vendor          = updates.vendor
  if (updates.amountTzs      !== undefined) dbUpdates.amount_tzs      = updates.amountTzs
  if (updates.amountUsd      !== undefined) dbUpdates.amount_usd      = updates.amountUsd
  if (updates.exchangeRate   !== undefined) dbUpdates.exchange_rate   = updates.exchangeRate
  if (updates.paymentMethod  !== undefined) dbUpdates.payment_method  = updates.paymentMethod
  if (updates.isRecurring    !== undefined) dbUpdates.is_recurring    = updates.isRecurring
  if (updates.recurringPeriod !== undefined) dbUpdates.recurring_period = updates.recurringPeriod
  if (updates.receiptUrl     !== undefined) dbUpdates.receipt_url     = updates.receiptUrl
  if (updates.status         !== undefined) dbUpdates.status          = updates.status
  if (updates.expenseDate !== undefined) {
    const d = new Date(updates.expenseDate)
    dbUpdates.expense_date = updates.expenseDate
    dbUpdates.month        = d.getMonth() + 1
    dbUpdates.year         = d.getFullYear()
    dbUpdates.week         = getWeekNumber(d)
  }
  dbUpdates.updated_at = new Date().toISOString()

  const { error } = await supabaseAdmin
    .from('expense_records')
    .update(dbUpdates)
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Delete expense record ─────────────────────────────────────────────────
export async function deleteExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('expense_records').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Get expense summary for a period ──────────────────────────────────────
export async function getExpenseSummary(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date?:  Date
}) {
  const { startDate, endDate } = getDateRange(params.period, params.date ?? new Date())

  const { data } = await supabaseAdmin
    .from('expense_records')
    .select('*')
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)
    .eq('status', 'paid')

  const byCategory: Record<string, number> = {}
  const byVendor:   Record<string, number> = {}
  let total = 0
  let recurringTotal = 0
  let oneTimeTotal   = 0

  for (const r of data ?? []) {
    const amt = Number(r.amount_tzs)
    total += amt
    byCategory[r.category] = (byCategory[r.category] ?? 0) + amt
    if (r.vendor) byVendor[r.vendor] = (byVendor[r.vendor] ?? 0) + amt
    if (r.is_recurring) recurringTotal += amt
    else oneTimeTotal += amt
  }

  return {
    total,
    byCategory,
    byVendor,
    expenseCount:  (data ?? []).length,
    recurringTotal,
    oneTimeTotal,
    startDate,
    endDate,
    records: data ?? [],
  }
}

// ── Process recurring expenses (add due ones as expense_records) ──────────
export async function processRecurringExpenses(): Promise<number> {
  const today = new Date().toISOString().split('T')[0]

  const { data: recurring } = await supabaseAdmin
    .from('recurring_expenses')
    .select('*')
    .eq('is_active', true)
    .lte('next_due_date', today)

  if (!recurring?.length) return 0

  console.log('[Accounting] Processing', recurring.length, 'recurring expenses')
  let processed = 0

  for (const exp of recurring) {
    const result = await addExpense({
      category:        exp.category,
      subcategory:     exp.subcategory,
      description:     `${exp.description} (Auto)`,
      vendor:          exp.vendor,
      amountTzs:       Number(exp.amount_tzs),
      amountUsd:       exp.amount_usd ? Number(exp.amount_usd) : undefined,
      paymentMethod:   exp.payment_method,
      expenseDate:     today,
      isRecurring:     true,
      recurringPeriod: exp.recurring_period,
      addedBy:         exp.added_by,
    })

    if (result.success) {
      // Advance next_due_date
      const next = new Date(exp.next_due_date)
      if (exp.recurring_period === 'annual')   next.setFullYear(next.getFullYear() + 1)
      else if (exp.recurring_period === 'weekly') next.setDate(next.getDate() + 7)
      else next.setMonth(next.getMonth() + 1)  // monthly default

      await supabaseAdmin
        .from('recurring_expenses')
        .update({ next_due_date: next.toISOString().split('T')[0] })
        .eq('id', exp.id)

      processed++
    }
  }

  return processed
}

// ── Recurring expense CRUD ────────────────────────────────────────────────
export async function addRecurringExpense(params: {
  category:        string
  subcategory?:    string
  description:     string
  vendor?:         string
  amountTzs:       number
  amountUsd?:      number
  paymentMethod?:  string
  recurringPeriod?: string
  nextDueDate:     string
  addedBy?:        string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('recurring_expenses')
    .insert({
      category:        params.category,
      subcategory:     params.subcategory,
      description:     params.description,
      vendor:          params.vendor,
      amount_tzs:      params.amountTzs,
      amount_usd:      params.amountUsd,
      payment_method:  params.paymentMethod,
      recurring_period: params.recurringPeriod ?? 'monthly',
      next_due_date:   params.nextDueDate,
      is_active:       true,
      added_by:        params.addedBy,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: data.id }
}

export async function updateRecurringExpense(
  id: string,
  updates: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('recurring_expenses')
    .update(updates)
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteRecurringExpense(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin.from('recurring_expenses').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
