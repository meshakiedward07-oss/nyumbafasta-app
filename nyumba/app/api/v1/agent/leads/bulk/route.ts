import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// ── Column aliases (case-insensitive) ─────────────────────────────────────────
const COL_ALIASES: Record<string, string[]> = {
  business_name: ['business_name', 'jina la biashara', 'jina', 'name', 'biashara', 'kampuni', 'duka', 'title'],
  phone:         ['phone', 'simu', 'tel', 'nambari', 'contact', 'telephone', 'namba ya simu'],
  email:         ['email', 'barua pepe', 'e-mail'],
  region:        ['region', 'mkoa', 'area', 'eneo', 'location'],
  notes:         ['notes', 'maelezo', 'comment', 'description', 'note', 'info'],
  whatsapp:      ['whatsapp', 'wa', 'whatsapp number', 'namba ya whatsapp', 'whatsapp url', 'whatsapp link'],
  facebook_url:  ['facebook_url', 'facebook', 'fb', 'fb page', 'ukurasa wa facebook', 'facebook page', 'fb url', 'fb link'],
  instagram_url: ['instagram_url', 'instagram', 'ig', 'instagram page', 'ig url', 'ig link'],
  tiktok_url:    ['tiktok_url', 'tiktok', 'tt', 'tiktok page', 'tt url'],
  website_url:   ['website_url', 'website', 'tovuti', 'webpage', 'website link'],
  source_url:    ['source_url', 'chanzo', 'source link', 'source url', 'link ya chanzo'],
  confidence:    ['confidence', 'score', 'ai_score', 'imani', 'kiwango', 'level', 'rating', 'alama'],
}

function matchColumn(header: string): string | null {
  const norm = header.toLowerCase().trim()
  for (const [field, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.some(a => norm === a || norm.startsWith(a))) return field
  }
  return null
}

function normalizePhone(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).replace(/[\s\-().]/g, '')
  if (!s) return null
  if (s.startsWith('+')) return s
  if (s.startsWith('255') && s.length === 12) return `+${s}`
  if (s.startsWith('0') && s.length === 10) return `+255${s.slice(1)}`
  if (s.length === 9) return `+255${s}`
  return s
}

// Extract phone number embedded in a WhatsApp URL
function phoneFromWhatsAppUrl(url: string | null): string | null {
  if (!url) return null
  // https://wa.me/255712000001 or http://wa.me/255712000001
  const waMe = url.match(/wa\.me\/(\d{7,15})/)
  if (waMe) return normalizePhone(waMe[1])
  // https://api.whatsapp.com/send?phone=255712000001
  const apiWa = url.match(/[?&]phone=(\d{7,15})/)
  if (apiWa) return normalizePhone(apiWa[1])
  // https://wa.link/... — can't extract, skip
  return null
}

// Normalise a URL value — ensure it has a scheme, return null if not a URL
function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const s = value.trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('www.') || s.includes('.')) return `https://${s}`
  return null
}

// Parse confidence/score from a cell value → integer 0-100
function parseConfidence(value: string | null | undefined): number {
  if (!value) return 50
  const n = parseFloat(value.replace('%', ''))
  if (isNaN(n)) return 50
  // Accept 0-1 scale (e.g. 0.85) or 0-100
  return Math.min(100, Math.max(0, n <= 1 ? Math.round(n * 100) : Math.round(n)))
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('')
    if ('formula'  in v) return String((v as ExcelJS.CellFormulaValue).result ?? '')
    if ('hyperlink' in v) return String((v as ExcelJS.CellHyperlinkValue).text ?? '')
  }
  return ''
}

// ── Simple CSV parser ─────────────────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    if (!line.trim()) continue
    const cells: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) { cells.push(cur.trim()); cur = '' }
      else cur += ch
    }
    cells.push(cur.trim())
    rows.push(cells)
  }
  return rows
}

// ── Parsed row shape ──────────────────────────────────────────────────────────
type ParsedRow = {
  business_name: string
  phone:         string | null
  email:         string | null
  region:        string | null
  notes:         string | null
  whatsapp:      string | null
  facebook_url:  string | null
  instagram_url: string | null
  tiktok_url:    string | null
  website_url:   string | null
  source_url:    string | null
  source:        'excel_import'
  ai_score:      number
  status:        'new'
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Faili halikupatikana' }, { status: 400 })

    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      return NextResponse.json(
        { error: 'Tumia faili la Excel (.xlsx, .xls) au CSV (.csv)' },
        { status: 400 },
      )
    }

    const arrayBuf = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuf)
    const parseErrors: { row: number; reason: string }[] = []

    // ── 1. Parse file into raw rows ───────────────────────────────────────────
    const rawRows: ParsedRow[] = []

    if (ext === 'csv') {
      const text    = buffer.toString('utf-8')
      const rows    = parseCSV(text)
      if (rows.length < 2) {
        return NextResponse.json({ error: 'CSV haina data ya kutosha' }, { status: 400 })
      }
      const headers = rows[0]
      const colToField: Record<number, string> = {}
      headers.forEach((h, i) => { const f = matchColumn(h); if (f) colToField[i] = f })
      if (!Object.values(colToField).includes('business_name')) {
        return NextResponse.json({ error: columnNotFoundError() }, { status: 400 })
      }
      for (let r = 1; r < rows.length; r++) {
        const rec: Record<string, string | null> = {}
        rows[r].forEach((val, i) => { if (colToField[i]) rec[colToField[i]] = val || null })
        addRecord(rec, r + 1, rawRows, parseErrors)
      }
    } else {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(arrayBuf)
      const sheet = workbook.worksheets[0]
      if (!sheet || sheet.rowCount < 2) {
        return NextResponse.json({ error: 'Faili haina data ya kutosha' }, { status: 400 })
      }
      const headerRow = sheet.getRow(1)
      const colToField: Record<number, string> = {}
      headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
        const f = matchColumn(cellText(cell))
        if (f) colToField[col] = f
      })
      if (!Object.values(colToField).includes('business_name')) {
        return NextResponse.json({ error: columnNotFoundError() }, { status: 400 })
      }
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return
        const rec: Record<string, string | null> = {}
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (colToField[col]) rec[colToField[col]] = cellText(cell) || null
        })
        addRecord(rec, rowNumber, rawRows, parseErrors)
      })
    }

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'Hakuna leads zilizobainiki kwenye faili', errors: parseErrors },
        { status: 400 },
      )
    }

    // ── 2. Deduplicate within the file ────────────────────────────────────────
    // Key preference: phone > facebook_url > instagram_url > tiktok_url > name
    const seenInFile = new Set<string>()
    const uniqueRows: ParsedRow[] = []
    let duplicatesInFile = 0

    for (const row of rawRows) {
      const keys = dedupeKeys(row)
      const seen = keys.some(k => seenInFile.has(k))
      if (seen) {
        duplicatesInFile++
      } else {
        keys.forEach(k => seenInFile.add(k))
        uniqueRows.push(row)
      }
    }

    // ── 3. Check existing DB leads ────────────────────────────────────────────
    const phones    = uniqueRows.map(r => r.phone).filter(Boolean) as string[]
    const fbUrls    = uniqueRows.map(r => r.facebook_url).filter(Boolean) as string[]
    const igUrls    = uniqueRows.map(r => r.instagram_url).filter(Boolean) as string[]
    const ttUrls    = uniqueRows.map(r => r.tiktok_url).filter(Boolean) as string[]
    const nameOnly  = uniqueRows.filter(r => !r.phone && !r.facebook_url && !r.instagram_url && !r.tiktok_url)
      .map(r => r.business_name.toLowerCase())

    const existingPhones = new Set<string>()
    const existingFb     = new Set<string>()
    const existingIg     = new Set<string>()
    const existingTt     = new Set<string>()
    const existingNames  = new Set<string>()

    await Promise.all([
      phones.length > 0 && supabaseAdmin
        .from('agent_leads').select('phone').in('phone', phones)
        .then(({ data }) => (data ?? []).forEach(r => r.phone && existingPhones.add(r.phone))),

      fbUrls.length > 0 && supabaseAdmin
        .from('agent_leads').select('facebook_url').in('facebook_url', fbUrls)
        .then(({ data }) => (data ?? []).forEach(r => r.facebook_url && existingFb.add(r.facebook_url))),

      igUrls.length > 0 && supabaseAdmin
        .from('agent_leads').select('instagram_url').in('instagram_url', igUrls)
        .then(({ data }) => (data ?? []).forEach(r => r.instagram_url && existingIg.add(r.instagram_url))),

      ttUrls.length > 0 && supabaseAdmin
        .from('agent_leads').select('tiktok_url').in('tiktok_url', ttUrls)
        .then(({ data }) => (data ?? []).forEach(r => r.tiktok_url && existingTt.add(r.tiktok_url))),

      nameOnly.length > 0 && supabaseAdmin
        .from('agent_leads').select('business_name').is('phone', null)
        .is('facebook_url', null).is('instagram_url', null).is('tiktok_url', null)
        .then(({ data }) => (data ?? []).forEach(r => existingNames.add((r.business_name as string).toLowerCase()))),
    ])

    const toInsert: ParsedRow[] = []
    let duplicatesInDb = 0

    for (const row of uniqueRows) {
      const inDb = (row.phone         && existingPhones.has(row.phone))
                || (row.facebook_url  && existingFb.has(row.facebook_url))
                || (row.instagram_url && existingIg.has(row.instagram_url))
                || (row.tiktok_url    && existingTt.has(row.tiktok_url))
                || (!row.phone && !row.facebook_url && !row.instagram_url && !row.tiktok_url
                    && existingNames.has(row.business_name.toLowerCase()))
      if (inDb) {
        duplicatesInDb++
      } else {
        toInsert.push(row)
      }
    }

    // ── 4. Bulk insert in 100-row chunks ──────────────────────────────────────
    let imported = 0
    const insertErrors: { row: number; reason: string }[] = []
    const CHUNK = 100

    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error: insertErr } = await supabaseAdmin
        .from('agent_leads')
        .insert(toInsert.slice(i, i + CHUNK))
      if (insertErr) {
        insertErrors.push({ row: i + 1, reason: insertErr.message })
      } else {
        imported += Math.min(CHUNK, toInsert.length - i)
      }
    }

    const allErrors = [...parseErrors, ...insertErrors]

    return NextResponse.json({
      success:         true,
      imported,
      duplicates_file: duplicatesInFile,
      duplicates_db:   duplicatesInDb,
      skipped:         allErrors.length,
      errors:          allErrors.slice(0, 20),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Hitilafu ya seva'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Template download ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth()
  if (!auth.ok) return auth.response

  const csv = [
    'business_name,phone,email,region,notes,whatsapp,facebook_url,instagram_url,tiktok_url,website_url,confidence',
    'Nyumba Bora Agency,0712345678,info@nyumbabora.co.tz,Dar es Salaam,Dalali mkubwa wa Masaki,0712345678,https://facebook.com/nyumbabora,https://instagram.com/nyumbabora,,https://nyumbabora.co.tz,85',
    'Karibu Rentals,+255 754 111 222,,Arusha,,,https://facebook.com/kariburentals,,,, 70',
    'Mlima Apartments,0765 333 444,mlima@gmail.com,Mwanza,,,,,https://tiktok.com/@mlimaapts,,60',
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads_template.csv"',
    },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function columnNotFoundError() {
  return 'Safu wima ya "business_name" / "Jina la Biashara" haikupatikana. Angalia mfano wa faili.'
}

// Return the dedup keys for a row, in priority order
function dedupeKeys(row: ParsedRow): string[] {
  const keys: string[] = []
  if (row.phone)         keys.push(`phone:${row.phone}`)
  if (row.facebook_url)  keys.push(`fb:${row.facebook_url}`)
  if (row.instagram_url) keys.push(`ig:${row.instagram_url}`)
  if (row.tiktok_url)    keys.push(`tt:${row.tiktok_url}`)
  if (keys.length === 0) keys.push(`name:${row.business_name.toLowerCase()}`)
  return keys
}

function addRecord(
  rec:    Record<string, string | null>,
  rowNum: number,
  out:    ParsedRow[],
  errors: { row: number; reason: string }[],
) {
  const name = rec.business_name?.trim()
  if (!name) { errors.push({ row: rowNum, reason: 'Jina la biashara halipo' }); return }

  const fbUrl  = normalizeUrl(rec.facebook_url)
  const igUrl  = normalizeUrl(rec.instagram_url)
  const ttUrl  = normalizeUrl(rec.tiktok_url)
  const waUrl  = rec.whatsapp?.trim() || null

  // Extract phone from whatsapp URL if raw phone is missing
  const rawPhone = normalizePhone(rec.phone)
  const phone    = rawPhone ?? phoneFromWhatsAppUrl(waUrl)

  const hasSocial = !!(fbUrl || igUrl || ttUrl || normalizeUrl(rec.website_url) || phone)

  // Skip leads with no contact info at all
  if (!phone && !hasSocial) {
    errors.push({ row: rowNum, reason: 'Hana simu wala akaunti ya kijamii — imepitwa' })
    return
  }

  const confidence = parseConfidence(rec.confidence)

  // whatsapp field: prefer normalised phone, then phone from URL, then the raw URL value
  const waNumber = normalizePhone(waUrl) ?? phone

  out.push({
    business_name: name,
    phone,
    email:         rec.email?.trim().toLowerCase() || null,
    region:        rec.region?.trim() || null,
    notes:         rec.notes?.trim() || null,
    whatsapp:      waNumber,
    facebook_url:  fbUrl,
    instagram_url: igUrl,
    tiktok_url:    ttUrl,
    website_url:   normalizeUrl(rec.website_url),
    source_url:    normalizeUrl(rec.source_url),
    source:        'excel_import',
    ai_score:      confidence,
    status:        'new',
  })
}
