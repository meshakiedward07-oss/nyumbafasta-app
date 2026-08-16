import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ reqId: string }> }

// GET /api/v1/fundi/jobs/:reqId — job detail + updates
export async function GET(_req: NextRequest, { params }: Params) {
  const { reqId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const { data: job, error } = await admin
      .from('maintenance_requests')
      .select('*, unit:property_units(id, unit_number, unit_type), org:organizations(id, name, phone, email), vendor:vendors(id, name, fundi_user_id)')
      .eq('id', reqId).single()
    if (error || !job) return NextResponse.json({ error: 'Kazi haipatikani' }, { status: 404 })

    const vendor = (job as unknown as Record<string, unknown>).vendor as { id: string; fundi_user_id: string | null } | null
    if (vendor?.fundi_user_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa ya kazi hii' }, { status: 403 })

    const { data: updates } = await admin.from('fundi_job_updates')
      .select('*').eq('maintenance_request_id', reqId).order('created_at', { ascending: true })

    return NextResponse.json({ job, updates: updates ?? [] })
  } catch (err) {
    console.error('[GET /fundi/jobs/:reqId/updates]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/fundi/jobs/:reqId/updates — post a job update
export async function POST(req: NextRequest, { params }: Params) {
  const { reqId } = await params
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Haujaingia' }, { status: 401 })
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('role, full_name').eq('id', user.id).single()
    if (profile?.role !== 'fundi') return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json()
    const { message } = body
    if (!message?.trim()) return NextResponse.json({ error: 'Ujumbe unahitajika' }, { status: 400 })

    const { data: job } = await admin
      .from('maintenance_requests')
      .select('id, org_id, title, vendor:vendors(fundi_user_id)')
      .eq('id', reqId).maybeSingle()
    const vendor = (job as unknown as Record<string, unknown>)?.vendor as { fundi_user_id: string | null } | null
    if (!job || vendor?.fundi_user_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa ya kazi hii' }, { status: 403 })

    const { data: update, error } = await admin.from('fundi_job_updates').insert({
      maintenance_request_id: reqId,
      fundi_user_id:          user.id,
      message:                message.trim(),
    }).select().single()
    if (error) throw error

    // Mirror update as a maintenance comment so org sees it on their detail page
    try {
      await admin.from('maintenance_comments').insert({
        request_id:    reqId,
        author_id:     user.id,
        body:          `🔧 Fundi: ${message.trim()}`,
        status_change: null,
      })
    } catch { /* non-fatal — comments table may have constraints */ }

    // Notify org members
    ;(async () => {
      try {
        const { data: members } = await admin.from('organization_members').select('user_id').eq('organization_id', job.org_id)
        if (members?.length) {
          await admin.from('notifications').insert(members.map(m => ({
            user_id: m.user_id,
            type:    'fundi_job_update',
            title:   'Fundi: Taarifa Mpya',
            body:    `${profile?.full_name ?? 'Fundi'} ametoa taarifa: ${message.trim().slice(0, 100)}`,
            data:    { maintenance_request_id: reqId },
            read:    false,
          })))
        }
      } catch { /* non-fatal */ }
    })().catch(() => {})

    return NextResponse.json({ update }, { status: 201 })
  } catch (err) {
    console.error('[POST /fundi/jobs/:reqId/updates]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
