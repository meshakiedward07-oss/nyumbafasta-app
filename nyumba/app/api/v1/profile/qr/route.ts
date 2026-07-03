import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 15

// GET /api/v1/profile/qr?u=<username>
// Proxies a QR code image for the dalali's profile URL.
// Verifies the username exists before serving so random strings don't generate QRs.
export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u')?.toLowerCase().trim()

  if (!u || !/^[a-z0-9_]{3,30}$/.test(u)) {
    return NextResponse.json({ error: 'Username si sahihi' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('username', u)
    .eq('role', 'dalali')
    .eq('is_active', true)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'Dalali hapatikani' }, { status: 404 })
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const profileUrl = `${APP_URL}/agent/${u}`

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(profileUrl)}&margin=20&color=1a1a18&bgcolor=ffffff&ecc=M&format=png`

  try {
    const res = await fetch(qrUrl)
    if (!res.ok) throw new Error('QR API failed')
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="nyumbafasta-${u}-qr.png"`,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[Profile/QR]', err)
    return NextResponse.json({ error: 'Imeshindwa kutengeneza QR' }, { status: 500 })
  }
}
