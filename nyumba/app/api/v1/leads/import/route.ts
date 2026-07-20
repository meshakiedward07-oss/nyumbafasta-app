import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { cleanPhone } from '@/lib/leads/cleanPhone'
import { verifyLeadBatch, normalizeUrl } from '@/lib/leads/socialChecker'
import { cache } from '@/lib/cache/memoryCache'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ── Column aliases ────────────────────────────────────────────────────────────
const COL_MAP: Record<string, string[]> = {
  full_name:       ['full_name','full name','jina','name','jina kamili','jina la biashara','business_name','business name','agent name','broker','dalali'],
  phone:           ['phone','simu','tel','telephone','namba ya simu','phone number','contact','mobile','nambari','contact number','public phone'],
  phone_2:         ['phone_2','phone2','simu 2','simu2','namba ya pili','phone alternate','simu nyingine'],
  email:           ['email','barua pepe','e-mail','email address','public email'],
  ward:            ['ward','mtaa','kata','street','barabara'],
  district:        ['district','wilaya','area','neighbourhood','neighborhood'],
  region:          ['region','mkoa','eneo','location'],
  facebook_url:    ['facebook','facebook_url','fb','fb page','facebook page','ukurasa wa facebook','fb url','fb link'],
  instagram_url:   ['instagram','instagram_url','ig','instagram page','ig url'],
  tiktok_url:      ['tiktok','tiktok_url','tt','tiktok page','tt url'],
  whatsapp_number: ['whatsapp','wa','whatsapp number','namba ya whatsapp','whatsapp url','whatsapp link','public whatsapp'],
  notes:           ['notes','maelezo','comment','description','note','info'],
  address:         ['address','anwani','mahali','location detail'],
}

function matchCol(header: string): string | null {
  const norm = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(COL_MAP)) {
    if (aliases.some(a => norm === a || norm.startsWith(a))) return field
  }
  return null
}

// Map raw Excel row → ParsedRow using column aliases
function mapRow(raw: Record<string, unknown>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const [col, val] of Object.entries(raw)) {
    const field = matchCol(col)
    if (field && val !== undefined && val !== null && val !== '') {
      out[field] = String(val).trim()
    }
  }
  // Additional scan for social URLs hidden in any column (only real URLs, not mentions)
  const urlPattern = /^https?:\/\//i
  const allVals = Object.values(raw).map(v => String(v || '').trim())
  for (const v of allVals) {
    if (!out.facebook_url  && urlPattern.test(v) && /facebook\.com|fb\.com/i.test(v))   out.facebook_url  = v
    if (!out.instagram_url && urlPattern.test(v) && /instagram\.com/i.test(v))           out.instagram_url = v
    if (!out.tiktok_url    && urlPattern.test(v) && /tiktok\.com/i.test(v))              out.tiktok_url    = v
    if (!out.whatsapp_number && v.includes('wa.me')) {
      const m = v.match(/wa\.me\/(\d{7,15})/)
      if (m) out.whatsapp_number = cleanPhone(m[1])
    }
  }
  return out
}

// ── AI Processing ─────────────────────────────────────────────────────────────
async function aiCleanChunk(rows: Record<string, unknown>[]): Promise<ProcessedRow[]> {
  try {
    const prompt = `Wewe ni AI wa kusafisha data za leads za real estate Tanzania.

Safisha rows hizi:
${JSON.stringify(rows, null, 2)}

Kwa kila row:
1. Toa full_name (jina kamili la mtu/biashara)
2. Safisha simu: ondoa nafasi/alama, 0XXXXXXXXX → +255XXXXXXXXX, 255XXXXXXXXX → +255XXXXXXXXX
3. Toa social media URLs (facebook, instagram, tiktok, whatsapp)
4. Toa eneo: ward/mtaa, district/wilaya, region/mkoa
5. Tambua kama ana mawasiliano halisi

Jibu JSON array PEKE YAKE (bila markdown):
[{"full_name":"","phone":null,"phone_2":null,"email":null,"ward":null,"district":null,"region":"Dar es Salaam","facebook_url":null,"instagram_url":null,"tiktok_url":null,"whatsapp_number":null,"notes":null,"address":null}]`

    const msg = await ai.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]'
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean) as ProcessedRow[]
  } catch {
    // Fallback: basic mapping without AI
    return rows.map(raw => {
      const mapped = mapRow(raw as Record<string, unknown>)
      return {
        full_name:       mapped.full_name    || (Object.values(raw).find(v => v && typeof v === 'string' && (v as string).length > 2) as string) || 'Unknown',
        phone:           cleanPhone(mapped.phone),
        phone_2:         cleanPhone(mapped.phone_2),
        email:           mapped.email        || null,
        ward:            mapped.ward         || null,
        district:        mapped.district     || null,
        region:          mapped.region       || 'Dar es Salaam',
        facebook_url:    normalizeUrl(mapped.facebook_url),
        instagram_url:   normalizeUrl(mapped.instagram_url),
        tiktok_url:      normalizeUrl(mapped.tiktok_url),
        whatsapp_number: cleanPhone(mapped.whatsapp_number),
        notes:           mapped.notes        || null,
        address:         mapped.address      || null,
      }
    })
  }
}

type ProcessedRow = {
  full_name: string
  phone: string | null
  phone_2: string | null
  email: string | null
  ward: string | null
  district: string | null
  region: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  whatsapp_number: string | null
  notes: string | null
  address: string | null
}

// ── Levenshtein similarity 0-100 ─────────────────────────────────────────────
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const s1 = a.toLowerCase().trim()
  const s2 = b.toLowerCase().trim()
  if (s1 === s2) return 100
  const l1 = s1.length, l2 = s2.length
  const dp: number[][] = Array.from({ length: l1 + 1 }, (_, i) =>
    Array.from({ length: l2 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= l1; i++)
    for (let j = 1; j <= l2; j++)
      dp[i][j] = s1[i-1] === s2[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return Math.round((1 - dp[l1][l2] / Math.max(l1, l2)) * 100)
}

// ── In-file duplicate detection ───────────────────────────────────────────────
// For large batches (>2000 rows), skip fuzzy name-similarity to avoid O(n²) timeout.
// Exact phone/social-URL matches still run for all batch sizes.
function detectInFileDuplicates(leads: ProcessedRow[]): (ProcessedRow & { is_duplicate: boolean; duplicate_reason: string | null; name_similarity_score: number | null })[] {
  const useFuzzySim = leads.length <= 2000
  const out = leads.map(l => ({ ...l, is_duplicate: false, duplicate_reason: null as string | null, name_similarity_score: null as number | null }))

  // Build exact-match indexes for O(1) lookup
  const phoneIndex   = new Map<string, number>()
  const fbIndex      = new Map<string, number>()
  const igIndex      = new Map<string, number>()
  const ttIndex      = new Map<string, number>()
  const waIndex      = new Map<string, number>()

  for (let i = 0; i < out.length; i++) {
    const a = out[i]
    if (a.is_duplicate) continue
    const reasons: string[] = []

    // Exact-match checks via index
    if (a.phone) {
      if (phoneIndex.has(a.phone)) reasons.push('Simu inafanana')
      else phoneIndex.set(a.phone, i)
    }
    if (a.facebook_url) {
      if (fbIndex.has(a.facebook_url)) reasons.push('Facebook URL inafanana')
      else fbIndex.set(a.facebook_url, i)
    }
    if (a.instagram_url) {
      if (igIndex.has(a.instagram_url)) reasons.push('Instagram URL inafanana')
      else igIndex.set(a.instagram_url, i)
    }
    if (a.tiktok_url) {
      if (ttIndex.has(a.tiktok_url)) reasons.push('TikTok URL inafanana')
      else ttIndex.set(a.tiktok_url, i)
    }
    if (a.whatsapp_number) {
      if (waIndex.has(a.whatsapp_number)) reasons.push('WhatsApp inafanana')
      else waIndex.set(a.whatsapp_number, i)
    }

    if (reasons.length > 0) {
      out[i].is_duplicate = true
      out[i].duplicate_reason = reasons.join(', ')
      continue
    }

    // Fuzzy name similarity — only for small batches
    if (useFuzzySim && a.ward) {
      for (let j = 0; j < i; j++) {
        if (out[j].is_duplicate) continue
        const b = out[j]
        if (!b.ward || b.ward.toLowerCase() !== a.ward.toLowerCase()) continue
        const sim = similarity(a.full_name, b.full_name)
        if (sim >= 80) {
          out[i].is_duplicate = true
          out[i].duplicate_reason = `Jina ${sim}% + ward moja`
          out[i].name_similarity_score = sim
          break
        }
      }
    }
  }
  return out
}

// ── Cross-check against existing DB leads ─────────────────────────────────────
function crossCheckDB(
  leads: ReturnType<typeof detectInFileDuplicates>,
  existing: { id: string; full_name: string; phone: string | null; ward: string | null; facebook_url: string | null; instagram_url: string | null; tiktok_url: string | null; whatsapp_number: string | null }[]
) {
  return leads.map(lead => {
    if (lead.is_duplicate) return { ...lead, duplicate_of: null }
    for (const ex of existing) {
      const reasons: string[] = []
      if (lead.phone && ex.phone && lead.phone === ex.phone) reasons.push('Simu ipo DB')
      if (lead.facebook_url && ex.facebook_url && lead.facebook_url === ex.facebook_url) reasons.push('Facebook ipo DB')
      if (lead.instagram_url && ex.instagram_url && lead.instagram_url === ex.instagram_url) reasons.push('Instagram ipo DB')
      if (lead.tiktok_url && ex.tiktok_url && lead.tiktok_url === ex.tiktok_url) reasons.push('TikTok ipo DB')
      if (lead.whatsapp_number && ex.whatsapp_number && lead.whatsapp_number === ex.whatsapp_number) reasons.push('WhatsApp ipo DB')
      const sim = similarity(lead.full_name, ex.full_name)
      if (sim >= 85 && lead.ward && ex.ward && lead.ward.toLowerCase() === ex.ward.toLowerCase()) reasons.push(`Jina ${sim}% + ward moja DB`)
      if (reasons.length > 0) {
        return { ...lead, is_duplicate: true, duplicate_of: ex.id, duplicate_reason: reasons.join(', ') }
      }
    }
    return { ...lead, duplicate_of: null }
  })
}

// ── POST /api/v1/leads/import ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  let batchId: string | null = null
  try {
    const formData = await req.formData()
    const file     = formData.get('file') as File | null
    const leadType = (formData.get('leadType') as string) || 'dalali'

    if (!file) return NextResponse.json({ error: 'Faili inahitajika' }, { status: 400 })

    // ── Parse Excel / CSV ──────────────────────────────────────────────────
    const buf = await file.arrayBuffer()
    const wb  = XLSX.read(buf, { type: 'array', raw: false, cellDates: false })
    const ws  = wb.Sheets[wb.SheetNames[0]]
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, defval: '' })

    if (!rawRows.length) return NextResponse.json({ error: 'Faili haina data' }, { status: 400 })

    // ── Create import batch ────────────────────────────────────────────────
    const { data: batch } = await supabaseAdmin
      .from('lead_import_batches')
      .insert({ filename: file.name, total_rows: rawRows.length, status: 'processing' })
      .select('id').single()
    batchId = batch?.id as string

    // ── AI process in chunks of 50 ─────────────────────────────────────────
    const CHUNK = 50
    const processed: ProcessedRow[] = []
    for (let i = 0; i < rawRows.length; i += CHUNK) {
      const slice = rawRows.slice(i, i + CHUNK)
      const chunk = await aiCleanChunk(slice)
      // Safety: if AI returns fewer rows than input, pad with fallback-mapped rows
      if (chunk.length < slice.length) {
        const fallback = slice.slice(chunk.length).map(raw => {
          const mapped = mapRow(raw)
          return { full_name: mapped.full_name || 'Unknown', phone: cleanPhone(mapped.phone), phone_2: cleanPhone(mapped.phone_2), email: mapped.email || null, ward: mapped.ward || null, district: mapped.district || null, region: mapped.region || 'Dar es Salaam', facebook_url: mapped.facebook_url || null, instagram_url: mapped.instagram_url || null, tiktok_url: mapped.tiktok_url || null, whatsapp_number: cleanPhone(mapped.whatsapp_number), notes: mapped.notes || null, address: mapped.address || null }
        })
        chunk.push(...fallback)
      } else if (chunk.length > slice.length) {
        chunk.splice(slice.length)
      }
      processed.push(...chunk)
    }

    // ── In-file duplicate detection ────────────────────────────────────────
    const withInFileDups = detectInFileDuplicates(processed)

    // ── Cross-check with DB (up to 5000 existing non-duplicates) ──────────────
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id,full_name,phone,ward,facebook_url,instagram_url,tiktok_url,whatsapp_number')
      .eq('is_duplicate', false)
      .limit(5000)

    const final = crossCheckDB(withInFileDups, existing || [])

    // ── Insert in batches of 200 ───────────────────────────────────────────
    let inserted = 0
    const INSERT_BATCH = 200
    for (let i = 0; i < final.length; i += INSERT_BATCH) {
      const slice = final.slice(i, i + INSERT_BATCH).map((lead, idx) => ({
        full_name:       lead.full_name || 'Unknown',
        phone:           cleanPhone(lead.phone),
        phone_2:         cleanPhone(lead.phone_2),
        email:           lead.email       || null,
        ward:            lead.ward        || null,
        district:        lead.district    || null,
        region:          lead.region      || 'Dar es Salaam',
        address:         lead.address     || null,
        facebook_url:    lead.facebook_url    || null,
        instagram_url:   lead.instagram_url   || null,
        tiktok_url:      lead.tiktok_url      || null,
        whatsapp_number: cleanPhone(lead.whatsapp_number) || lead.whatsapp_number || null,
        notes:           lead.notes       || null,
        lead_type:       leadType,
        source:          'excel',
        is_duplicate:    lead.is_duplicate,
        duplicate_of:    lead.duplicate_of || null,
        duplicate_reason: lead.duplicate_reason || null,
        name_similarity_score: lead.name_similarity_score || null,
        import_batch_id: batchId,
        import_row_number: i + idx + 1,
        original_data:   rawRows[i + idx] || {},
      }))
      const { data: ins, error: insErr } = await supabaseAdmin.from('leads').insert(slice).select('id')
      if (insErr) throw insErr
      inserted += ins?.length || 0
    }

    // ── Stats ──────────────────────────────────────────────────────────────
    const duplicatesFound = final.filter(l => l.is_duplicate).length
    const deadFound       = final.filter(l => !l.phone && !l.facebook_url && !l.instagram_url && !l.tiktok_url && !l.whatsapp_number).length
    const activeLeads     = inserted - duplicatesFound - deadFound

    // ── Auto-verify social links (first 15 non-duplicate leads with social URLs) ──
    let socialVerified = 0
    let socialActive = 0
    let socialInactive = 0
    try {
      const { data: toVerify } = await supabaseAdmin
        .from('leads')
        .select('id,facebook_url,instagram_url,tiktok_url,whatsapp_number')
        .eq('import_batch_id', batchId)
        .eq('is_duplicate', false)
        .eq('is_dead_lead', false)
        .or('facebook_url.not.is.null,instagram_url.not.is.null,tiktok_url.not.is.null,whatsapp_number.not.is.null')
        .limit(15)

      if (toVerify?.length) {
        const results = await verifyLeadBatch(toVerify, 250)
        for (const result of results) {
          if (Object.keys(result.updates).length > 0) {
            await supabaseAdmin.from('leads').update(result.updates).eq('id', result.id)
            socialVerified++
            const activeCount = result.summary.filter(s => s.status === 'active').length
            if (activeCount > 0) socialActive++
            else socialInactive++
          }
        }
      }
    } catch (verifyErr) {
      console.warn('[Import] Social verify failed (non-fatal):', verifyErr)
    }

    await supabaseAdmin
      .from('lead_import_batches')
      .update({
        imported:         inserted,
        duplicates_found: duplicatesFound,
        dead_leads_found: deadFound,
        active_leads:     Math.max(0, activeLeads),
        status:           'completed',
        completed_at:     new Date().toISOString(),
      })
      .eq('id', batchId)

    cache.delete('leads:stats:global')

    return NextResponse.json({
      success: true,
      batchId,
      stats: {
        total:      rawRows.length,
        imported:   inserted,
        duplicates: duplicatesFound,
        deadLeads:  deadFound,
        activeLeads: Math.max(0, activeLeads),
        socialVerified,
        socialActive,
        socialInactive,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    console.error('[Leads Import]', msg)
    // Mark batch as failed so it doesn't stay 'processing' forever
    if (typeof batchId === 'string') {
      await supabaseAdmin
        .from('lead_import_batches')
        .update({ status: 'failed', error_message: msg, completed_at: new Date().toISOString() })
        .eq('id', batchId)
        .then(() => {}) // fire-and-forget, don't shadow original error
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
