import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

type Params = { params: Promise<{ id: string }> }

// GET /api/v1/advertising/campaigns/[id]/creative/sign
// Returns Supabase Storage signed upload URLs for direct browser-to-storage upload.
// This bypasses Vercel's 4.5 MB request body limit — files go straight to Supabase.
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id: campaignId } = await params
    const admin = createAdminClient()

    // Verify campaign belongs to this advertiser
    const { data: campaign } = await admin
      .from('ad_campaigns')
      .select('id, advertiser_id')
      .eq('id', campaignId)
      .eq('advertiser_id', auth.advertiser.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    }

    const count    = Math.min(parseInt(req.nextUrl.searchParams.get('count') ?? '1', 10), 10)
    const mimeType = req.nextUrl.searchParams.get('mimeType') ?? 'image/jpeg'
    const ext      = mimeType.startsWith('video/') ? 'mp4'
      : mimeType === 'image/png' ? 'png'
      : mimeType === 'image/webp' ? 'webp'
      : mimeType === 'image/gif' ? 'gif'
      : 'jpg'

    const uploads = await Promise.all(
      Array.from({ length: count }, async () => {
        const path = `ad-uploads/${auth.advertiser.id}/${campaignId}/${randomUUID()}.${ext}`
        const { data, error } = await admin.storage
          .from('listings')
          .createSignedUploadUrl(path)

        if (error || !data) {
          throw new Error(`Haikuweza kuunda URL ya upakiaji: ${error?.message ?? 'unknown'}`)
        }
        return { signedUrl: data.signedUrl, token: data.token, path }
      }),
    )

    return NextResponse.json({ uploads })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CreativeSign GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
