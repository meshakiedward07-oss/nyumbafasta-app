import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/social/marketplace/inquiries
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: inquiries } = await supabaseAdmin
    .from('marketplace_inquiries')
    .select(`
      *,
      listings(title, district, region)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ inquiries: inquiries ?? [] })
}
