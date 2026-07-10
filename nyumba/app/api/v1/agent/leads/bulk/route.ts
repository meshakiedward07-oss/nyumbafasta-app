import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'stream'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminAuth } from '@/lib/security/adminAuth'

export const dynamic = 'force-dynamic'

// ── Column name aliases (case-insensitive) ────────────────────────────────────
const COL_ALIASES: Record<string, string[]> = {
  business_name: ['business_name', 'jina la biashara', 'jina', 'name', 'biashara', 'kampuni', 'duka', 'title'],
  phone:         ['phone', 'simu', 'tel', 'nambari', 'contact', 'telephone', 'namba ya simu'],
  email:         ['email', 'barua pepe', 'e-mail'],
  region:        ['region', 'mkoa', 'area', 'eneo', 'location'],
  notes:         ['notes', 'maelezo', 'comment', 'description', 'note', 'info'],
  whatsapp:      ['whatsapp', 'wa', 'whatsapp number', 'namba ya whatsapp'],
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
    const toInsert: Record<string, unknown>[] = []
    const errors: { row: number; reason: string }[] = []

    if (ext === 'csv') {
      // ── CSV path ──────────────────────────────────────────────────────────
      const text   = buffer.toString('utf-8')
      const rows   = parseCSV(text)
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
        const cells = rows[r]
        const rec: Record<string, string | null> = {}
        cells.forEach((val, i) => { if (colToField[i]) rec[colToField[i]] = val || null })
        addRecord(rec, r + 1, toInsert, errors)
      }
    } else {
      // ── Excel path ────────────────────────────────────────────────────────
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
        addRecord(rec, rowNumber, toInsert, errors)
      })
    }

    if (toInsert.length === 0) {
      return NextResponse.json(
        { error: 'Hakuna leads zilizobainiki kwenye faili', errors },
        { status: 400 },
      )
    }

    // ── Bulk insert in 100-row chunks ─────────────────────────────────────
    let imported = 0
    const CHUNK = 100
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const { error: insertErr } = await supabaseAdmin
        .from('agent_leads')
        .insert(toInsert.slice(i, i + CHUNK))
      if (insertErr) {
        errors.push({ row: i + 1, reason: insertErr.message })
      } else {
        imported += Math.min(CHUNK, toInsert.length - i)
      }
    }

    return NextResponse.json({
      success:  true,
      imported,
      skipped:  errors.length,
      errors:   errors.slice(0, 20),
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
    'business_name,phone,email,region,notes,whatsapp',
    'Nyumba Bora Agency,0712345678,info@nyumbabora.co.tz,Dar es Salaam,Dalali mkubwa wa Masaki,0712345678',
    'Karibu Rentals,+255 754 111 222,,Arusha,,',
    'Mlima Apartments,0765 333 444,mlima@gmail.com,Mwanza,Wanahitajika premium,,',
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

function addRecord(
  rec:      Record<string, string | null>,
  rowNum:   number,
  out:      Record<string, unknown>[],
  errors:   { row: number; reason: string }[],
) {
  const name = rec.business_name?.trim()
  if (!name) { errors.push({ row: rowNum, reason: 'Jina la biashara halipo' }); return }

  const phone = normalizePhone(rec.phone)
  out.push({
    business_name: name,
    phone,
    email:         rec.email?.trim().toLowerCase() || null,
    region:        rec.region?.trim() || null,
    notes:         rec.notes?.trim() || null,
    whatsapp:      normalizePhone(rec.whatsapp) ?? phone,
    source:        'excel_import',
    ai_score:      50,
    status:        'new',
  })
}
