import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getOrCreateWallet } from '@/lib/payments/wallet'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin  = createAdminClient()
    const wallet = await getOrCreateWallet(user.id, admin)

    const { data: transactions } = await admin
      .from('wallet_transactions')
      .select('id, type, amount, description, status, created_at, provider, reference_type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      balance:      wallet.balance,
      currency:     wallet.currency,
      is_frozen:    wallet.is_frozen,
      updated_at:   wallet.updated_at,
      transactions: transactions ?? [],
    })
  } catch (err) {
    console.error('[Wallet/GET]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
