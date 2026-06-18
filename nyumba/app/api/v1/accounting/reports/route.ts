import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePDFReport, generateExcelReport } from '@/lib/accounting/reportGenerator'

export const maxDuration = 120

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/accounting/reports?format=pdf|excel&period=monthly&date=2026-06-01
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = req.nextUrl
    const format  = searchParams.get('format') ?? 'pdf'
    const period  = (searchParams.get('period') ?? 'monthly') as 'daily' | 'weekly' | 'monthly' | 'yearly'
    const dateStr = searchParams.get('date')
    const date    = dateStr ? new Date(dateStr) : new Date()

    if (!['pdf', 'excel'].includes(format)) {
      return NextResponse.json({ error: 'format lazima iwe pdf au excel' }, { status: 400 })
    }

    const monthLabel = date.toLocaleDateString('sw-TZ', { month: 'long', year: 'numeric' })
      .replace(/\s/g, '_').toLowerCase()

    if (format === 'excel') {
      const buf = await generateExcelReport({ period, date })
      return new NextResponse(buf as unknown as BodyInit, {
        headers: {
          'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="nyumbafasta_hesabu_${monthLabel}.xlsx"`,
        },
      })
    }

    // PDF
    const buf = await generatePDFReport({ period, date })
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="nyumbafasta_ripoti_${monthLabel}.pdf"`,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Accounting/reports] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
