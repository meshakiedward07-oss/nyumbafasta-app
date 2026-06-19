import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function isHttpUrl(v: string) {
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' }
  catch { return false }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify ownership
    const { data: listing } = await admin
      .from('listings')
      .select('id, dalali_id, status')
      .eq('id', params.id)
      .maybeSingle()

    if (!listing) return NextResponse.json({ error: 'Listing haikupatikana' }, { status: 404 })
    if (listing.dalali_id !== user.id) return NextResponse.json({ error: 'Huna ruhusa' }, { status: 403 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Taarifa si sahihi' }, { status: 400 })

    const { price_monthly, images } = body as { price_monthly?: unknown; images?: unknown }

    // Validate
    const errors: string[] = []
    const update: Record<string, unknown> = {}

    if (price_monthly !== undefined) {
      const price = Number(price_monthly)
      if (!Number.isFinite(price) || price < 1000 || price > 100_000_000) {
        errors.push('Bei si sahihi (1,000 – 100,000,000)')
      } else {
        update.price_monthly = price
      }
    }

    if (images !== undefined) {
      if (
        !Array.isArray(images) ||
        images.length > 10 ||
        !images.every((u: unknown) => typeof u === 'string' && isHttpUrl(u))
      ) {
        errors.push('Picha si sahihi')
      } else {
        update.images = images as string[]
      }
    }

    if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
    if (Object.keys(update).length === 0) return NextResponse.json({ success: true })

    const { error: updateError } = await admin
      .from('listings')
      .update(update)
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
