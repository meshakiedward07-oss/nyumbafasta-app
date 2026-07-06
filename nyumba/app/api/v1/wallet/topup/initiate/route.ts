import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  mobileCheckout, normalizePhone, detectProvider,
  generateExternalId, type MobileProvider,
} from '@/lib/payments/azampay'
import { createPendingTopup } from '@/lib/payments/wallet'
import { rateLimit } from '@/lib/security/rateLimit'

export const maxDuration = 30

const MIN_TOPUP   = 1_000
const MAX_TOPUP   = 500_000
const IS_MOCK     = process.env.AZAMPAY_MOCK === 'true'

function toAzamProvider(p: string): MobileProvider {
  const map: Record<string, MobileProvider> = {
    mpesa: 'Mpesa', airtel: 'Airtel', tigo: 'Tigo', tigopesa: 'Tigo', halopesa: 'Halopesa', azampesa: 'Azampesa',
    Mpesa: 'Mpesa', Airtel: 'Airtel', Tigo: 'Tigo', Halopesa: 'Halopesa', Azampesa: 'Azampesa',
    AirtelMoney: 'Airtel', Tigopesa: 'Tigo',
  }
  return map[p] ?? 'Mpesa'
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const rl = await rateLimit(`wallet-topup:${user.id}`, 5, 5 * 60 * 1000)
    if (!rl.allowed) return NextResponse.json({ error: 'Maombi mengi sana — subiri dakika 5' }, { status: 429 })

    const { amount, msisdn, provider = 'mpesa' } = await req.json()

    if (!amount || amount < MIN_TOPUP || amount > MAX_TOPUP || !Number.isInteger(amount)) {
      return NextResponse.json({ error: `Kiasi lazima kiwe kati ya Tsh ${MIN_TOPUP.toLocaleString()} na Tsh ${MAX_TOPUP.toLocaleString()}` }, { status: 400 })
    }
    if (!msisdn) return NextResponse.json({ error: 'Namba ya simu inahitajika' }, { status: 400 })

    const accountNumber = normalizePhone(msisdn)
    if (!accountNumber.startsWith('255') || accountNumber.length !== 12 || !/^\d{12}$/.test(accountNumber)) {
      return NextResponse.json({ error: 'Namba ya simu si sahihi. Tumia format ya Tanzania (07XXXXXXXX)' }, { status: 400 })
    }

    const admin       = createAdminClient()
    const azamProvider = toAzamProvider(provider) ?? detectProvider(accountNumber)
    const externalId  = generateExternalId('WTP')

    // ── Mock mode: credit wallet immediately ──────────────────
    if (IS_MOCK) {
      const { creditWallet } = await import('@/lib/payments/wallet')
      await creditWallet({
        userId:      user.id,
        amount,
        description: `Weka pesa (mock) — ${azamProvider}`,
        externalId,
        msisdn:      accountNumber,
        provider:    azamProvider,
      }, admin)

      await admin.from('notifications').insert({
        user_id: user.id,
        title:   '✅ Wallet Imewekwa!',
        body:    `Tsh ${amount.toLocaleString()} imeongezwa kwenye wallet yako.`,
        type:    'wallet_topup',
        is_read: false,
      })

      return NextResponse.json({ mock: true, amount, message: 'Wallet imewekwa (test mode)' })
    }

    // ── Production: create pending tx, initiate USSD ──────────
    const txId = await createPendingTopup({ userId: user.id, amount, externalId, msisdn: accountNumber, provider: azamProvider }, admin)

    const result = await mobileCheckout({
      accountNumber,
      amount,
      externalId,
      provider: azamProvider,
    })

    if (!result.ok) {
      // Delete the pending tx so webhook doesn't mistakenly credit later
      await admin.from('wallet_transactions').delete().eq('id', txId)
      return NextResponse.json({ error: result.message }, { status: 502 })
    }

    return NextResponse.json({
      success:    true,
      topup_ref:  externalId,
      amount,
      message:    'Ombi limetumwa. Angalia simu yako na ingiza PIN.',
    })
  } catch (err) {
    console.error('[Wallet/topup/initiate]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Hitilafu ya seva' }, { status: 500 })
  }
}
