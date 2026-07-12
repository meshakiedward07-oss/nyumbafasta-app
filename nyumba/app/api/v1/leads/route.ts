import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { verifySingleLead } from '@/lib/leads/socialChecker'

export const dynamic = 'force-dynamic'

// ── Helpers ───────────────────────────────────────────────────────────────────

export function cleanPhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).replace(/[\s\-(). ]/g, '').replace(/^\+/, '')
  if (!s) return null
  if (s.startsWith('255') && s.length === 12) return `+${s}`
  if (s.startsWith('0') && s.length === 10) return `+255${s.slice(1)}`
  if (s.length === 9 && /^\d+$/.test(s)) return `+255${s}`
  if (s.length > 7) return s.startsWith('+') ? s : `+${s}`
  return null
}

// ── GET — list leads with filters ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')  || '1'))
    const limit    = Math.min(200, parseInt(searchParams.get('limit') || '50'))
    const offset   = (page - 1) * limit

    const search       = searchParams.get('search')  || ''
    const quality      = searchParams.get('quality') || ''
    const leadType     = searchParams.get('type')    || ''
    const status       = searchParams.get('status')  || ''
    const socialFilter = searchParams.get('social')  || ''
    const ward         = searchParams.get('ward')    || ''
    const batchId      = searchParams.get('batch')   || ''
    const showDups     = searchParams.get('duplicates') === 'true'
    const showDead     = searchParams.get('dead')       === 'true'

    let q = supabaseAdmin
      .from('leads')
      .select('id,full_name,phone,phone_2,email,ward,district,region,lead_type,source,notes,facebook_url,instagram_url,tiktok_url,whatsapp_number,facebook_status,instagram_status,tiktok_status,whatsapp_status,social_score,contact_quality,has_valid_phone,has_any_social,is_dead_lead,is_duplicate,duplicate_reason,name_similarity_score,status,contacted_at,registered_at,assigned_to,import_batch_id,created_at', { count: 'exact' })

    if (!showDups)  q = q.eq('is_duplicate', false)
    if (!showDead)  q = q.eq('is_dead_lead', false)
    if (quality)    q = q.eq('contact_quality', quality)
    if (leadType)   q = q.eq('lead_type', leadType)
    if (status)     q = q.eq('status', status)
    if (ward)       q = q.ilike('ward', `%${ward}%`)
    if (batchId)    q = q.eq('import_batch_id', batchId)

    if (socialFilter === 'has_facebook')       q = q.not('facebook_url', 'is', null)
    else if (socialFilter === 'has_instagram') q = q.not('instagram_url', 'is', null)
    else if (socialFilter === 'has_tiktok')    q = q.not('tiktok_url', 'is', null)
    else if (socialFilter === 'has_whatsapp')  q = q.not('whatsapp_number', 'is', null)
    else if (socialFilter === 'active_social') q = q.eq('has_any_social', true)
    else if (socialFilter === 'none')          q = q.eq('has_any_social', false)

    if (search) {
      q = q.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,ward.ilike.%${search}%,district.ilike.%${search}%`)
    }

    const { data, count, error } = await q
      .order('social_score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      leads: data || [],
      pagination: {
        page, limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: page > 1,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST — add single lead manually ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const body = await req.json() as Record<string, string>

    const { data, error } = await supabaseAdmin
      .from('leads')
      .insert({
        full_name:       body.full_name?.trim(),
        phone:           cleanPhone(body.phone),
        phone_2:         cleanPhone(body.phone_2),
        email:           body.email?.trim()    || null,
        ward:            body.ward?.trim()     || null,
        district:        body.district?.trim() || null,
        region:          body.region?.trim()   || 'Dar es Salaam',
        address:         body.address?.trim()  || null,
        lead_type:       body.lead_type        || 'dalali',
        source:          'manual',
        notes:           body.notes?.trim()    || null,
        facebook_url:    body.facebook_url?.trim()    || null,
        instagram_url:   body.instagram_url?.trim()   || null,
        tiktok_url:      body.tiktok_url?.trim()      || null,
        whatsapp_number: cleanPhone(body.whatsapp_number) || body.whatsapp_number?.trim() || null,
        status:          'new',
      })
      .select()
      .single()

    if (error) throw error

    // Auto-verify social links immediately for manual adds
    const hasSocial = data.facebook_url || data.instagram_url || data.tiktok_url || data.whatsapp_number
    if (hasSocial) {
      const result = await verifySingleLead({
        id: data.id,
        facebook_url:  data.facebook_url,
        instagram_url: data.instagram_url,
        tiktok_url:    data.tiktok_url,
        whatsapp_number: data.whatsapp_number,
      })
      if (Object.keys(result.updates).length > 0) {
        await supabaseAdmin.from('leads').update(result.updates).eq('id', data.id)
        Object.assign(data, result.updates)
      }
    }

    return NextResponse.json({ success: true, lead: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH — update lead ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { id, ...updates } = await req.json() as Record<string, unknown>
    if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id as string)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, lead: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── DELETE — remove lead ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = new URL(req.url)
    const id   = searchParams.get('id')
    const type = searchParams.get('type') || 'soft'

    if (!id) return NextResponse.json({ error: 'ID inahitajika' }, { status: 400 })

    if (type === 'hard') {
      const { error } = await supabaseAdmin.from('leads').delete().eq('id', id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin
        .from('leads').update({ status: 'inactive' }).eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
