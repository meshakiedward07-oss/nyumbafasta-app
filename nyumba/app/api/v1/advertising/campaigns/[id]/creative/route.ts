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

// Presigned-only now (see 2026-09-01 ads-creative audit): this route used
// to also accept a raw multipart upload sent directly through this Vercel
// function, duplicating ~130 lines of the presigned path's processing logic
// with no test coverage keeping them in sync, AND silently reintroducing
// the exact "hangs against Vercel's 4.5MB hard body-size ceiling" bug class
// that the presigned-URL flow was specifically built to avoid (found and
// fixed for this same route, and others, earlier the same day) — the stated
// 10MB/100MB limits in that branch were never actually enforceable by
// Vercel regardless of what the code claimed. It had already been fully
// unreachable from the UI since UploadCreative.tsx was switched to
// presigned-only; removed rather than left as a live, untested, regression
// trap for a future caller.
export async function POST(req: NextRequest, { params }: Params) {
  try {
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
    const needsReReview = campaign.status === 'approved' || campaign.status === 'active' || campaign.status === 'queued'

    let body: { mode?: string; paths?: string[]; mimeType?: string; force?: boolean }
    try { body = await req.json() } catch { return NextResponse.json({ error: 'JSON si sahihi' }, { status: 400 }) }

    if (body.mode !== 'presigned' || !body.paths?.length) {
      return NextResponse.json({ error: 'mode si sahihi' }, { status: 400 })
    }

    // `await` here (not a bare `return handlePresigned(...)`) is required
    // for the outer try/catch to actually catch a later rejection — e.g.
    // checkImageRatio/sharp throwing on a malformed file, which happens
    // before handlePresigned's own inner try blocks start. Returning the
    // promise directly would exit this try block before it could reject.
    return await handlePresigned({
      admin, campaignId, advertiserId: auth.advertiser.id,
      paths: body.paths, mimeType: body.mimeType ?? 'image/jpeg', force: body.force ?? false, needsReReview,
    })

  } catch (err) {
    // Catches anything thrown outside handlePresigned's own try/catch too —
    // e.g. checkImageRatio/sharp failing on a malformed file before a
    // creative row even exists. Previously unhandled here, this route would
    // surface a raw framework error instead of the app's usual JSON shape.
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST .../creative]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
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
    // Clean up the temp upload here too — this was the main direct source
    // of orphaned Storage files (found 2026-09-01): the success path
    // already removed `paths`, but ANY processing failure (a bad video,
    // Cloudinary rejecting the upload, a transient Storage error on a
    // variant) left the original ad-uploads/ file behind forever, since
    // nothing else ever revisits it. The daily cron's age-based sweep
    // (app/api/v1/cron/daily/route.ts) is the backstop for the other
    // source — an abandoned browser tab that never reaches this handler
    // at all — but most orphans came from here, not that.
    await admin.storage.from('listings').remove(paths).catch(() => {})
    return NextResponse.json({ error: 'Haikuweza kushughulikia faili. Jaribu tena.', detail: String(err) }, { status: 500 })
  }
}

// GET — return current creative for this campaign
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdvertiserAuth()
    if (!auth.ok) return auth.response

    const { id: campaignId } = await params
    const admin = createAdminClient()

    // Ownership check (IDOR fix, 2026-09-01 audit): this used to query
    // ad_creatives by campaign_id alone, with no check that campaignId
    // belongs to the calling advertiser. ad_creatives DOES have an RLS
    // policy scoping rows to their owning advertiser — but this route uses
    // the service-role admin client, which bypasses RLS entirely, so the
    // DB-level protection never applied here. Any authenticated advertiser
    // could read any OTHER advertiser's creative (URLs, processing_status,
    // error_message) by passing their campaign id.
    const { data: campaign } = await admin
      .from('ad_campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('advertiser_id', auth.advertiser.id)
      .maybeSingle()

    if (!campaign) {
      return NextResponse.json({ error: 'Kampeni haikupatikana' }, { status: 404 })
    }

    const { data } = await admin
      .from('ad_creatives')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({ creative: data ?? null })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET .../creative]', msg)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
