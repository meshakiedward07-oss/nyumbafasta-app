import { NextRequest, NextResponse } from 'next/server'
import { requireAdvertiserAuth } from '@/lib/security/advertiserAuth'
import { createAdminClient } from '@/lib/supabase/server'
import {
  checkImageRatio,
  processImage,
  processCarousel,
  uploadOriginal,
  uploadVideo,
} from '@/lib/ads/creative'

type Params = { params: Promise<{ id: string }> }

// Max sizes: images 10 MB, videos 100 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const { id: campaignId } = await params
  const admin = createAdminClient()

  // Verify campaign belongs to this advertiser
  const { data: campaign, error: campErr } = await admin
    .from('ad_campaigns')
    .select('id, advertiser_id, ad_type, status')
    .eq('id', campaignId)
    .eq('advertiser_id', auth.advertiser.id)
    .single()

  if (campErr || !campaign) {
    return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
  }

  // Any already-reviewed campaign (approved-and-awaiting-payment, or already
  // live) that gets a NEW creative attached must go back through admin
  // review — this used to be unconditional, so an advertiser could swap the
  // image/video on a currently-LIVE campaign at any time with zero re-review,
  // fully bypassing content moderation for real site visitors. Found in the
  // 2026-09-01 ads-system audit. Re-queuing to 'pending_review' also
  // immediately pulls it from ad rotation (fetcher/rankingEngine only serve
  // status='active'); the existing "already paid → reactivate on approval"
  // logic in the admin approve routes brings it straight back once reviewed.
  const needsReReview = campaign.status === 'approved' || campaign.status === 'active'

  const contentType = req.headers.get('content-type') ?? ''
  const isJson      = contentType.includes('application/json')

  // ── Presigned mode: files already uploaded directly to Supabase Storage ─────
  // The browser used GET /sign to get a signed URL, PUT the file to Supabase,
  // then POSTs here with just the storage paths. No large body crosses Vercel.
  if (isJson) {
    let body: { mode?: string; paths?: string[]; mimeType?: string; force?: boolean }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON si sahihi' }, { status: 400 }) }

    if (body.mode === 'presigned' && body.paths?.length) {
      return handlePresigned({ admin, campaignId, advertiserId: auth.advertiser.id, paths: body.paths, mimeType: body.mimeType ?? 'image/jpeg', force: body.force ?? false, needsReReview })
    }
    return NextResponse.json({ error: 'mode si sahihi' }, { status: 400 })
  }

  // ── Multipart mode: small file sent directly (kept for ratio-only check) ─────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Faili hazikupokewa vizuri' }, { status: 400 })
  }

  const force      = formData.get('force') === 'true'
  const checkOnly  = formData.get('checkOnly') === 'true'
  const files      = formData.getAll('files') as File[]
  const singleFile = formData.get('file') as File | null
  const allFiles   = singleFile ? [singleFile] : files

  if (allFiles.length === 0) {
    return NextResponse.json({ error: 'Tafadhali pakia faili moja au zaidi' }, { status: 400 })
  }

  const firstFile  = allFiles[0]
  const isVideo    = firstFile.type.startsWith('video/')
  const isCarousel = !isVideo && allFiles.length > 1

  // Size validation
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  for (const f of allFiles) {
    if (f.size > maxBytes) {
      return NextResponse.json({
        error: `Faili "${f.name}" ni kubwa mno. Ukubwa wa juu: ${isVideo ? '100MB' : '10MB'}`,
      }, { status: 413 })
    }
    if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
      return NextResponse.json({
        error: `Aina ya faili "${f.name}" hairuhusiwi. Pakia picha au video tu.`,
      }, { status: 400 })
    }
  }

  // Read buffers
  const buffers = await Promise.all(allFiles.map(f => f.arrayBuffer().then(Buffer.from)))

  // Ratio check for images (skip if force=true)
  if (!isVideo && !force) {
    const check = await checkImageRatio(buffers[0])
    if (!check.ok) {
      return NextResponse.json({ warning: true, message: check.message, ratio: check.ratio }, { status: 422 })
    }
  }

  // If this was a ratio-check-only request, stop here
  if (checkOnly) return NextResponse.json({ ok: true })

  const advertiserId = auth.advertiser.id

  // Create creative record (processing)
  const mediaType = isVideo ? 'video' : isCarousel ? 'carousel' : 'image'
  const { data: creative, error: createErr } = await admin
    .from('ad_creatives')
    .insert({
      advertiser_id:     advertiserId,
      campaign_id:       campaignId,
      media_type:        mediaType,
      original_url:      '',
      processing_status: 'processing',
    })
    .select('id')
    .single()

  if (createErr || !creative) {
    return NextResponse.json({ error: 'Haikuweza kuunda rekodi ya creative' }, { status: 500 })
  }

  const creativeId = creative.id
  const basePath   = `ad-creatives/${advertiserId}/${creativeId}`
  // Applied to every ad_campaigns update below — see needsReReview comment above.
  const reReview: Record<string, unknown> = needsReReview
    ? { status: 'pending_review', admin_note: null }
    : {}

  try {
    if (isVideo) {
      // ── Video: upload to Cloudinary, get thumbnail URL ──
      const result = await uploadVideo(buffers[0], firstFile.type, advertiserId)

      await admin.from('ad_creatives').update({
        media_type:        'video',
        original_url:      result.original_url,
        video_url:         result.video_url,
        video_thumb_url:   result.video_thumb_url,
        processing_status: 'done',
      }).eq('id', creativeId)

      await admin.from('ad_campaigns').update({
        creative_id: creativeId,
        video_url:   result.video_url,
        image_url:   result.video_thumb_url,
        ...reReview,
      }).eq('id', campaignId)

    } else if (isCarousel) {
      // ── Multiple images: process each, first image = cover ──
      const originalUrls = await Promise.all(
        buffers.map((buf, i) =>
          uploadOriginal(buf, allFiles[i].type, `${basePath}/original-${i}`)
        ),
      )

      const { carousel_urls, first } = await processCarousel(buffers, basePath, originalUrls)

      await admin.from('ad_creatives').update({
        media_type:        'carousel',
        original_url:      originalUrls[0],
        banner_url:        first.banner_url,
        search_url:        first.search_url,
        nearby_url:        first.nearby_url,
        featured_url:      first.featured_url,
        video_thumb_url:   first.video_thumb_url,
        carousel_urls,
        processing_status: 'done',
      }).eq('id', creativeId)

      await admin.from('ad_campaigns').update({
        creative_id: creativeId,
        image_url:   first.banner_url,
        ...reReview,
      }).eq('id', campaignId)

    } else {
      // ── Single image: process all variants ──
      const originalUrl = await uploadOriginal(buffers[0], firstFile.type, `${basePath}/original`)
      const variants    = await processImage(buffers[0], basePath, originalUrl)

      await admin.from('ad_creatives').update({
        media_type:        'image',
        ...variants,
        processing_status: 'done',
      }).eq('id', creativeId)

      await admin.from('ad_campaigns').update({
        creative_id: creativeId,
        image_url:   variants.banner_url,
        ...reReview,
      }).eq('id', campaignId)
    }

    // Return the finished creative
    const { data: done } = await admin
      .from('ad_creatives')
      .select('*')
      .eq('id', creativeId)
      .single()

    return NextResponse.json({ ok: true, creative: done }, { status: 201 })

  } catch (err) {
    console.error('[CreativeUpload] multipart processing failed:', err)
    await admin.from('ad_creatives').update({
      processing_status: 'failed',
      error_message: String(err),
    }).eq('id', creativeId)

    return NextResponse.json({
      error: 'Haikuweza kushughulikia faili. Jaribu tena.',
      detail: String(err),
    }, { status: 500 })
  }
}

// ── Presigned handler — files already in Supabase Storage, just process them ──
async function handlePresigned({
  admin, campaignId, advertiserId, paths, mimeType, force, needsReReview,
}: {
  admin: ReturnType<typeof import('@/lib/supabase/server').createAdminClient>
  campaignId: string
  advertiserId: string
  paths: string[]
  mimeType: string
  force: boolean
  needsReReview: boolean
}): Promise<NextResponse> {
  const isVideo    = mimeType.startsWith('video/')
  const isCarousel = !isVideo && paths.length > 1
  const mediaType  = isVideo ? 'video' : isCarousel ? 'carousel' : 'image'

  // Download files FIRST — before touching the DB
  let buffers: Buffer[]
  try {
    buffers = await Promise.all(
      paths.map(async path => {
        const { data, error } = await admin.storage.from('listings').download(path)
        if (error || !data) throw new Error(`Haikuweza kupakua faili: ${error?.message ?? path}`)
        return Buffer.from(await data.arrayBuffer())
      }),
    )
  } catch (err) {
    await admin.storage.from('listings').remove(paths).catch(() => {})
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  // Ratio check BEFORE creating the DB record — no orphaned records on failure
  if (!isVideo && !force) {
    const check = await checkImageRatio(buffers[0])
    if (!check.ok) {
      await admin.storage.from('listings').remove(paths).catch(() => {})
      return NextResponse.json({ warning: true, error: check.message, message: check.message, ratio: check.ratio }, { status: 422 })
    }
  }

  const { data: creative, error: createErr } = await admin
    .from('ad_creatives')
    .insert({ advertiser_id: advertiserId, campaign_id: campaignId, media_type: mediaType, original_url: '', processing_status: 'processing' })
    .select('id')
    .single()

  if (createErr || !creative) {
    return NextResponse.json({ error: 'Haikuweza kuunda rekodi ya creative' }, { status: 500 })
  }

  const creativeId = creative.id
  const basePath   = `ad-creatives/${advertiserId}/${creativeId}`
  // Applied to every ad_campaigns update below — see needsReReview comment
  // in the POST handler above (content-moderation-bypass fix).
  const reReview: Record<string, unknown> = needsReReview
    ? { status: 'pending_review', admin_note: null }
    : {}

  try {
    if (isVideo) {
      const result = await uploadVideo(buffers[0], mimeType, advertiserId)
      await admin.from('ad_creatives').update({ media_type: 'video', original_url: result.original_url, video_url: result.video_url, video_thumb_url: result.video_thumb_url, processing_status: 'done' }).eq('id', creativeId)
      await admin.from('ad_campaigns').update({ creative_id: creativeId, video_url: result.video_url, image_url: result.video_thumb_url, ...reReview }).eq('id', campaignId)
    } else if (isCarousel) {
      const originalUrls = await Promise.all(buffers.map((buf, i) => uploadOriginal(buf, mimeType, `${basePath}/original-${i}`)))
      const { carousel_urls, first } = await processCarousel(buffers, basePath, originalUrls)
      await admin.from('ad_creatives').update({ media_type: 'carousel', ...first, original_url: originalUrls[0], carousel_urls, processing_status: 'done' }).eq('id', creativeId)
      await admin.from('ad_campaigns').update({ creative_id: creativeId, image_url: first.banner_url, ...reReview }).eq('id', campaignId)
    } else {
      const originalUrl = await uploadOriginal(buffers[0], mimeType, `${basePath}/original`)
      const variants    = await processImage(buffers[0], basePath, originalUrl)
      await admin.from('ad_creatives').update({ media_type: 'image', ...variants, processing_status: 'done' }).eq('id', creativeId)
      await admin.from('ad_campaigns').update({ creative_id: creativeId, image_url: variants.banner_url, ...reReview }).eq('id', campaignId)
    }

    // Clean up the temporary upload files
    await admin.storage.from('listings').remove(paths).catch(() => {})

    const { data: done } = await admin.from('ad_creatives').select('*').eq('id', creativeId).single()
    return NextResponse.json({ ok: true, creative: done }, { status: 201 })

  } catch (err) {
    console.error('[CreativeUpload] presigned processing failed:', err)
    await admin.from('ad_creatives').update({ processing_status: 'failed', error_message: String(err) }).eq('id', creativeId)
    return NextResponse.json({ error: 'Haikuweza kushughulikia faili. Jaribu tena.', detail: String(err) }, { status: 500 })
  }
}

// GET — return current creative for this campaign
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdvertiserAuth()
  if (!auth.ok) return auth.response

  const { id: campaignId } = await params
  const admin = createAdminClient()

  const { data } = await admin
    .from('ad_creatives')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ creative: data ?? null })
}
