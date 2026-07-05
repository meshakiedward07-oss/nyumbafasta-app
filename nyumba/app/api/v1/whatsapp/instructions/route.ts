import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/whatsapp/instructions — list active instructions
export async function GET(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const phone = searchParams.get('phone')

  // Two separate parameterised queries instead of raw string interpolation in .or()
  // which was an injection surface when phone came from user input.
  let rows: Record<string, unknown>[] = []

  if (phone) {
    const [globalRes, specificRes] = await Promise.all([
      supabaseAdmin
        .from('amina_instructions')
        .select('id, instruction, scope, phone_number, active, created_at')
        .eq('active', true)
        .eq('scope', 'global')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('amina_instructions')
        .select('id, instruction, scope, phone_number, active, created_at')
        .eq('active', true)
        .eq('scope', 'phone_specific')
        .eq('phone_number', phone)
        .order('created_at', { ascending: false }),
    ])
    if (globalRes.error)   return NextResponse.json({ error: globalRes.error.message },   { status: 500 })
    if (specificRes.error) return NextResponse.json({ error: specificRes.error.message }, { status: 500 })
    rows = [...(globalRes.data ?? []), ...(specificRes.data ?? [])] as Record<string, unknown>[]
  } else {
    const { data, error } = await supabaseAdmin
      .from('amina_instructions')
      .select('id, instruction, scope, phone_number, active, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows = (data ?? []) as Record<string, unknown>[]
  }

  return NextResponse.json({ instructions: rows })
}

// POST /api/v1/whatsapp/instructions — add an instruction
// Body: { instruction: string, scope: 'global'|'phone_specific', phone_number?: string }
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
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
