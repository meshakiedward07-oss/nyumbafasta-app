import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

// GET /api/v1/social/marketplace/inquiries
export async function GET() {
  const admin = await getAdminUser()
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
