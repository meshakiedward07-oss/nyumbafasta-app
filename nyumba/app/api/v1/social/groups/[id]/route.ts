import { NextRequest, NextResponse } from 'next/server'
import { toggleGroup, deleteGroup } from '@/lib/social/facebookGroups'
import { requireAdminUser } from '@/lib/security/adminAuth'

// PATCH /api/v1/social/groups/[id] — toggle active/inactive
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { isActive } = await req.json() as { isActive: boolean }

  try {
    await toggleGroup(params.id, isActive)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/v1/social/groups/[id] — remove group
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await deleteGroup(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
