// In-app wallet: get/create, credit, debit.
// All mutations go through the admin client (bypasses RLS).
// Balance is stored as integer TZS — no decimals.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface WalletRow {
  id:          string
  user_id:     string
  balance:     number
  currency:    string
  is_frozen:   boolean
  created_at:  string
  updated_at:  string
}

export interface WalletTransaction {
  id:              string
  wallet_id:       string
  user_id:         string
  type:            'topup' | 'payment' | 'refund'
  amount:          number
  balance_before:  number
  balance_after:   number
  description?:    string
  reference_type?: string
  reference_id?:   string
  external_id?:    string
  msisdn?:         string
  provider?:       string
  status:          'pending' | 'completed' | 'failed'
  created_at:      string
}

// Auto-creates wallet on first use
export async function getOrCreateWallet(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
): Promise<WalletRow> {
  const { data: existing } = await admin
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as WalletRow

  const { data: created, error } = await admin
    .from('wallets')
    .insert({ user_id: userId })
    .select('*')
    .single()

  if (error || !created) {
    // Handle race condition: another request may have created it concurrently
    const { data: retry } = await admin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single()
    if (retry) return retry as WalletRow
    throw new Error(`Imeshindwa kuunda wallet: ${error?.message}`)
  }

  return created as WalletRow
}

export interface CreditParams {
  userId:          string
  amount:          number
  description?:    string
  referenceType?:  string
  referenceId?:    string
  externalId?:     string
  msisdn?:         string
  provider?:       string
}

// Credit wallet. Creates wallet if it doesn't exist.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function creditWallet(params: CreditParams, admin: SupabaseClient<any>): Promise<WalletRow> {
  const wallet = await getOrCreateWallet(params.userId, admin)

  if (wallet.is_frozen) throw new Error('Wallet imezuiwa. Wasiliana na msaada.')

  const newBalance = wallet.balance + params.amount

  const { data: updated, error: updateErr } = await admin
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)
    .select('*')
    .single()

  if (updateErr || !updated) throw new Error(`Imeshindwa kuongeza salio: ${updateErr?.message}`)

  await admin.from('wallet_transactions').insert({
    wallet_id:       wallet.id,
    user_id:         params.userId,
    type:            'topup',
    amount:          params.amount,
    balance_before:  wallet.balance,
    balance_after:   newBalance,
    description:     params.description ?? 'Weka pesa',
    reference_type:  params.referenceType,
    reference_id:    params.referenceId,
    external_id:     params.externalId,
    msisdn:          params.msisdn,
    provider:        params.provider,
    status:          'completed',
  })

  return updated as WalletRow
}

export interface DebitParams {
  userId:          string
  amount:          number
  description?:    string
  referenceType?:  string
  referenceId?:    string
}

export interface DebitResult {
  ok:      boolean
  wallet?: WalletRow
  message: string
}

// Atomic debit — uses WHERE balance >= amount to prevent overdraft.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function debitWallet(params: DebitParams, admin: SupabaseClient<any>): Promise<DebitResult> {
  const wallet = await getOrCreateWallet(params.userId, admin)

  if (wallet.is_frozen)           return { ok: false, message: 'Wallet imezuiwa. Wasiliana na msaada.' }
  if (wallet.balance < params.amount) return { ok: false, message: `Salio halikutosha. Una Tsh ${wallet.balance.toLocaleString()} — unahitaji Tsh ${params.amount.toLocaleString()}` }

  // Atomic update: only succeeds if balance is still sufficient at execution time
  const { data: updated, error: updateErr } = await admin
    .from('wallets')
    .update({ balance: wallet.balance - params.amount })
    .eq('id', wallet.id)
    .gte('balance', params.amount)  // atomic guard
    .select('*')
    .single()

  if (updateErr || !updated) {
    return { ok: false, message: 'Salio halikutosha au hitilafu ya seva.' }
  }

  await admin.from('wallet_transactions').insert({
    wallet_id:       wallet.id,
    user_id:         params.userId,
    type:            'payment',
    amount:          params.amount,
    balance_before:  wallet.balance,
    balance_after:   (updated as WalletRow).balance,
    description:     params.description ?? 'Malipo',
    reference_type:  params.referenceType,
    reference_id:    params.referenceId,
    status:          'completed',
  })

  return { ok: true, wallet: updated as WalletRow, message: 'Malipo yamefanikiwa' }
}

// Create a pending topup transaction so the webhook can find it
export async function createPendingTopup(params: {
  userId:     string
  amount:     number
  externalId: string
  msisdn:     string
  provider:   string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}, admin: SupabaseClient<any>): Promise<string> {
  const wallet = await getOrCreateWallet(params.userId, admin)

  const { data, error } = await admin
    .from('wallet_transactions')
    .insert({
      wallet_id:      wallet.id,
      user_id:        params.userId,
      type:           'topup',
      amount:         params.amount,
      balance_before: wallet.balance,
      balance_after:  wallet.balance,  // updated by webhook
      description:    'Weka pesa kwenye wallet',
      external_id:    params.externalId,
      msisdn:         params.msisdn,
      provider:       params.provider,
      status:         'pending',
    })
    .select('id')
    .single()

  if (error || !data) throw new Error(`Imeshindwa kuunda topup: ${error?.message}`)
  return data.id as string
}

// Confirm pending topup after webhook fires
export async function confirmPendingTopup(
  externalId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
): Promise<{ ok: boolean; message: string }> {
  const { data: tx } = await admin
    .from('wallet_transactions')
    .select('id, wallet_id, user_id, amount, status')
    .eq('external_id', externalId)
    .eq('type', 'topup')
    .eq('status', 'pending')
    .maybeSingle()

  if (!tx) return { ok: false, message: 'Topup haipatikani au tayari imechakatwa' }

  // Get current wallet balance
  const { data: wallet } = await admin
    .from('wallets')
    .select('id, balance')
    .eq('id', tx.wallet_id)
    .single()

  if (!wallet) return { ok: false, message: 'Wallet haipatikani' }

  const newBalance = wallet.balance + tx.amount

  // Update wallet balance
  const { error: walletErr } = await admin
    .from('wallets')
    .update({ balance: newBalance })
    .eq('id', wallet.id)

  if (walletErr) return { ok: false, message: `Imeshindwa kusasisha salio: ${walletErr.message}` }

  // Update transaction to completed
  await admin
    .from('wallet_transactions')
    .update({ status: 'completed', balance_before: wallet.balance, balance_after: newBalance })
    .eq('id', tx.id)

  return { ok: true, message: `Wallet imewekwa Tsh ${tx.amount.toLocaleString()}` }
}

// Mark a pending topup as failed
export async function failPendingTopup(
  externalId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
): Promise<void> {
  await admin
    .from('wallet_transactions')
    .update({ status: 'failed' })
    .eq('external_id', externalId)
    .eq('type', 'topup')
    .eq('status', 'pending')
}
