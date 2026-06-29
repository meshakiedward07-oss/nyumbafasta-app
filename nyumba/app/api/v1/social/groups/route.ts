import { NextRequest, NextResponse } from 'next/server'
import { getAllGroups, addGroup } from '@/lib/social/facebookGroups'
import { requireAdminUser } from '@/lib/security/adminAuth'

// GET /api/v1/social/groups — list all groups
export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const groups = await getAllGroups()
    return NextResponse.json({ groups })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/v1/social/groups — add new group
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { groupId, groupName, groupUrl, membersCount, category } = await req.json() as {
    groupId:       string
    groupName:     string
    groupUrl?:     string
    membersCount?: number
    category?:     string
  }

  if (!groupId || !groupName) {
    return NextResponse.json({ error: 'groupId na groupName vinahitajika' }, { status: 400 })
  }

  try {
    const group = await addGroup({ groupId, groupName, groupUrl, membersCount, category })
    return NextResponse.json({ ok: true, group })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hitilafu isiyojulikana'
    console.error('[Groups API] Add group error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
