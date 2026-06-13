import { NextRequest, NextResponse } from 'next/server'
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

// GET /api/v1/whatsapp/instructions — list active instructions
export async function GET(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const phone = searchParams.get('phone')

  let query = supabaseAdmin
    .from('amina_instructions')
    .select('id, instruction, scope, phone_number, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })

  if (phone) {
    query = query.or(`scope.eq.global,and(scope.eq.phone_specific,phone_number.eq.${phone})`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ instructions: data ?? [] })
}

// POST /api/v1/whatsapp/instructions — add an instruction
// Body: { instruction: string, scope: 'global'|'phone_specific', phone_number?: string }
export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { instruction, scope, phone_number } = await req.json() as {
    instruction: string
    scope: 'global' | 'phone_specific'
    phone_number?: string
  }

  if (!instruction?.trim()) {
    return NextResponse.json({ error: 'instruction required' }, { status: 400 })
  }
  if (scope === 'phone_specific' && !phone_number) {
    return NextResponse.json({ error: 'phone_number required for phone_specific scope' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('amina_instructions')
    .insert({
      admin_id:    admin.id,
      instruction: instruction.trim(),
      scope:       scope ?? 'global',
      phone_number: scope === 'phone_specific' ? phone_number : null,
      active:      true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ instruction: data })
}
