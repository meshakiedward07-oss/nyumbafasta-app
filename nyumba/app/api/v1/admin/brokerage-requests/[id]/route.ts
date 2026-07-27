import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { recordIncomeFromBrokerageCommission } from '@/lib/accounting/incomeTracker'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

// Fire-and-forget: notify the org contact (WhatsApp + in-app) when staff acts
async function notifyOrg(
  admin: ReturnType<typeof createAdminClient>,
  req_: Record<string, unknown>,
  message: string,
  notifTitle: string,
  notifBody: string,
) {
  try {
    const submittedBy = req_.submitted_by as string | null
    if (submittedBy) {
      await admin.from('notifications').insert({
        user_id:  submittedBy,
        title:    notifTitle,
        body:     notifBody,
        type:     'brokerage_update',
        is_read:  false,
      })
    }
    const phone = req_.org_contact_phone as string | null
    if (phone) {
      const { formatPhoneNumber, sendTextMessage } = await import('@/lib/whatsapp/client')
      await sendTextMessage(formatPhoneNumber(phone), message).catch(() => {})
    }
  } catch { /* non-fatal */ }
}

type Params = { params: Promise<{ id: string }> }

// PATCH /api/v1/admin/brokerage-requests/[id]
// Actions: approve | reject | post | close_deal | commission_invoiced | commission_received
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin  = createAdminClient()
    const body   = await req.json()
    const { action, rejection_reason, notes } = body

    // Fetch current request
    const { data: req_, error: fetchErr } = await admin
      .from('brokerage_requests')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !req_) return NextResponse.json({ error: 'Ombi halipatikani' }, { status: 404 })

    // ── approve ──────────────────────────────────────────────
    if (action === 'approve') {
      if (req_.status !== 'pending') return NextResponse.json({ error: 'Ombi hili haliwezi kuidhinishwa' }, { status: 409 })

      const { data, error } = await admin
        .from('brokerage_requests')
        .update({ status: 'approved', reviewed_by: auth.userId, reviewed_at: new Date().toISOString() })
        .eq('id', id).select().single()

      if (error) throw error
      notifyOrg(
        admin, req_,
        `✅ *Ombi lako la Brokerage Limeidhinishwa!*\n\nHabari!\n\nOmbi lako la brokerage kwa *${req_.title}* limeidhinishwa na NyumbaFasta. Tutaanza kutangaza hivi karibuni.\n\n👉 ${APP_URL}/property/brokerage`,
        '✅ Ombi la Brokerage Limeidhinishwa',
        `Ombi lako la brokerage kwa "${req_.title}" limeidhinishwa. Tutaanza kutangaza hivi karibuni.`,
      ).catch(() => {})
      return NextResponse.json({ request: data })
    }

    // ── reject ───────────────────────────────────────────────
    if (action === 'reject') {
      if (!['pending', 'approved'].includes(req_.status)) {
        return NextResponse.json({ error: 'Ombi hili haliwezi kukataliwa' }, { status: 409 })
      }
      const { data, error } = await admin
        .from('brokerage_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejection_reason?.trim() || null,
          reviewed_by: auth.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id).select().single()

      if (error) throw error
      const reason = rejection_reason?.trim() || 'Maombi hayakukidhi mahitaji yetu'
      notifyOrg(
        admin, req_,
        `❌ *Ombi la Brokerage Limekataliwa*\n\nHabari!\n\nOmbi lako la brokerage kwa *${req_.title}* limekataliwa.\n\n📝 Sababu: ${reason}\n\nUnaweza kuwasilisha ombi jipya ukiboresha maelezo.\n\n👉 ${APP_URL}/property/brokerage`,
        '❌ Ombi la Brokerage Limekataliwa',
        `Ombi lako kwa "${req_.title}" limekataliwa. Sababu: ${reason}`,
      ).catch(() => {})
      return NextResponse.json({ request: data })
    }

    // ── post — create listing through NF platform broker account ──
    if (action === 'post') {
      if (req_.status !== 'approved') {
        return NextResponse.json({ error: 'Idhini ombi kwanza kabla ya kutangaza' }, { status: 409 })
      }

      const { broker_id } = body

      // Find platform broker — use specified one or fall back to first available
      let brokerQuery = admin
        .from('dalali_profiles')
        .select('user_id, whatsapp_number, broker_whatsapp')
        .eq('is_platform_broker', true)

      if (broker_id) {
        brokerQuery = brokerQuery.eq('user_id', broker_id)
      }

      const { data: broker } = await brokerQuery.limit(1).single()

      if (!broker) {
        return NextResponse.json({
          error: broker_id
            ? 'Broker aliyechaguliwa haipatikani. Chagua broker mwingine.'
            : 'Hakuna akaunti ya NyumbaFasta Broker. Unda broker kwanza kwenye sehemu ya Brokers.',
        }, { status: 422 })
      }

      const whatsapp = broker.broker_whatsapp || broker.whatsapp_number

      // Build listing description
      const desc = [
        req_.description?.trim(),
        '',
        '🏠 Inashughulikiwa na NyumbaFasta. Wasiliana nasi kupitia WhatsApp kwa maelezo zaidi.',
      ].filter(Boolean).join('\n')

      // Create the listing
      const { data: listing, error: listErr } = await admin
        .from('listings')
        .insert({
          dalali_id:             broker.user_id,
          listing_source:        'nyumbafasta_managed',
          brokerage_request_id:  id,
          title:                 req_.title,
          type:                  req_.listing_type,
          description:           desc,
          price_monthly:         req_.price_monthly,
          deposit_months:        req_.deposit_months,
          bedrooms:              req_.bedrooms,
          furnished:             req_.furnished,
          region:                req_.region,
          district:              req_.district,
          ward:                  req_.ward,
          mtaa:                  req_.mtaa,
          amenities:             req_.amenities,
          images:                req_.images,
          status:                'active',
          lifecycle_status:      'active',
          phone_override:        whatsapp || null,
        })
        .select('id, title')
        .single()

      if (listErr) throw listErr

      // Update brokerage request
      const { data: updated, error: updErr } = await admin
        .from('brokerage_requests')
        .update({
          listing_id: listing.id,
          status:     'listed',
          posted_by:  auth.userId,
          posted_at:  new Date().toISOString(),
        })
        .eq('id', id).select().single()

      if (updErr) throw updErr
      notifyOrg(
        admin, req_,
        `🏠 *Tangazo Lako Limeandaliwa!*\n\nHabari!\n\nNyumbaFasta sasa inatangaza nyumba yako.\n\n🔗 Angalia tangazo: ${APP_URL}/listings/${listing.id}\n\nWapangaji watapowasiliana, staff wetu watakupiga simu.\n\n👉 ${APP_URL}/property/brokerage`,
        '🏠 Tangazo Limeandaliwa na NyumbaFasta',
        `NyumbaFasta sasa inatangaza "${req_.title}". Watapata mpangaji haraka!`,
      ).catch(() => {})
      return NextResponse.json({ request: updated, listing })
    }

    // ── close_deal — deal is done, commission becomes due ────
    if (action === 'close_deal') {
      if (req_.status !== 'listed') {
        return NextResponse.json({ error: 'Ombi lazima liwe katika hali ya "listed" kufunga deal' }, { status: 409 })
      }

      const { tenant_user_id } = body

      // Update request status
      const { data: updated, error: updErr } = await admin
        .from('brokerage_requests')
        .update({
          status:          'deal_closed',
          deal_closed_at:  new Date().toISOString(),
          tenant_user_id:  tenant_user_id || null,
          commission_status: 'pending',
        })
        .eq('id', id).select().single()

      if (updErr) throw updErr

      // Mark the listing as taken
      if (req_.listing_id) {
        await admin.from('listings').update({
          status:           'taken',
          lifecycle_status: 'taken',
        }).eq('id', req_.listing_id)
      }

      // Auto-create a brokerage_commissions record for the admin tracker
      if (req_.listing_id) {
        await admin.from('brokerage_commissions').insert({
          listing_id:        req_.listing_id,
          landlord_id:       req_.submitted_by,
          staff_id:          auth.userId,
          calculated_amount: req_.commission_amount,
          collection_status: 'pending',
          notes:             `Brokerage ombi #${id.slice(0, 8)} — ${req_.title} — kamisheni ya mwezi 1 wa kodi`,
        }).single()
      }

      notifyOrg(
        admin, req_,
        `🎉 *Deal Imefungwa!*\n\nHabari!\n\nDeal ya *${req_.title}* imefungwa. Asante kwa kuamini NyumbaFasta.\n\nKamisheni itakuwasiliana nawe hivi karibuni.\n\n👉 ${APP_URL}/property/brokerage`,
        '🎉 Deal Imefungwa!',
        `Deal ya "${req_.title}" imefungwa kikamilifu. Asante kwa kutumia NyumbaFasta Brokerage.`,
      ).catch(() => {})

      return NextResponse.json({ request: updated })
    }

    // ── commission_invoiced ──────────────────────────────────
    if (action === 'commission_invoiced') {
      if (req_.status !== 'deal_closed') {
        return NextResponse.json({ error: 'Deal lazima imefungwa kwanza' }, { status: 409 })
      }
      const { data, error } = await admin
        .from('brokerage_requests')
        .update({
          commission_status:       'invoiced',
          commission_invoiced_at:  new Date().toISOString(),
          commission_notes:        notes?.trim() || req_.commission_notes,
        })
        .eq('id', id).select().single()

      if (error) throw error

      // Sync to brokerage_commissions
      if (req_.listing_id) {
        await admin.from('brokerage_commissions')
          .update({ collection_status: 'invoiced', invoice_sent_at: new Date().toISOString() })
          .eq('listing_id', req_.listing_id)
      }

      return NextResponse.json({ request: data })
    }

    // ── commission_received ──────────────────────────────────
    if (action === 'commission_received') {
      if (!['deal_closed'].includes(req_.status)) {
        return NextResponse.json({ error: 'Deal lazima imefungwa kwanza' }, { status: 409 })
      }
      const { amount } = body
      const { data, error } = await admin
        .from('brokerage_requests')
        .update({
          commission_status:           'received',
          commission_received_at:      new Date().toISOString(),
          commission_received_amount:  amount ? Number(amount) : req_.commission_amount,
          commission_notes:            notes?.trim() || req_.commission_notes,
        })
        .eq('id', id).select().single()

      if (error) throw error

      // Sync to brokerage_commissions
      if (req_.listing_id) {
        await admin.from('brokerage_commissions')
          .update({
            collection_status: 'collected',
            collected_at:      new Date().toISOString(),
            proof_url:         body.proof_url || null,
          })
          .eq('listing_id', req_.listing_id)
      }

      // Record in central income_records (fire-and-forget — non-fatal)
      recordIncomeFromBrokerageCommission(
        id,
        amount ? Number(amount) : undefined,
      ).catch(err => console.error('[BrokerageIncome] Non-fatal record error:', err))

      return NextResponse.json({ request: data })
    }

    // ── cancel (org-initiated, but staff can also cancel) ────
    if (action === 'cancel') {
      if (['deal_closed', 'listed'].includes(req_.status)) {
        return NextResponse.json({ error: 'Haiwezekani kufuta ombi hili katika hali hii' }, { status: 409 })
      }
      const { data, error } = await admin
        .from('brokerage_requests')
        .update({ status: 'cancelled' })
        .eq('id', id).select().single()

      if (error) throw error
      return NextResponse.json({ request: data })
    }

    return NextResponse.json({ error: 'Kitendo kisichojulikana' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /admin/brokerage-requests/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// GET /api/v1/admin/brokerage-requests/[id]
// Full detail: request + contact unlocks (leads) on the listing
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireStaffAuth()
    if (!auth.ok) return auth.response

    const { id } = await params
    const admin  = createAdminClient()

    const { data: request, error } = await admin
      .from('brokerage_requests')
      .select(`
        *,
        org:organizations!org_id(id, name, phone, region),
        submitter:users!submitted_by(id, full_name, phone, email),
        poster:users!posted_by(id, full_name),
        listing:listings!listing_id(id, title, status, lifecycle_status, images)
      `)
      .eq('id', id)
      .single()

    if (error || !request) return NextResponse.json({ error: 'Halipatikani' }, { status: 404 })

    // Contact unlocks (leads) on the brokerage listing
    let leads: unknown[] = []
    if (request.listing_id) {
      const { data: unlocks } = await admin
        .from('contact_unlocks')
        .select(`
          id, created_at, payment_method, amount_paid,
          tenant:users!tenant_id(id, full_name, phone, email)
        `)
        .eq('listing_id', request.listing_id)
        .order('created_at', { ascending: false })
      leads = unlocks ?? []
    }

    return NextResponse.json({ request, leads })
  } catch (err) {
    console.error('[GET /admin/brokerage-requests/[id]]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
