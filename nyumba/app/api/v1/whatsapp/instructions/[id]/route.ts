import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { requireStaffAuth } from '@/lib/security/adminAuth'

// DELETE /api/v1/whatsapp/instructions/[id] — deactivate instruction
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { error } = await supabaseAdmin
    .from('amina_instructions')
    .update({ active: false })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
