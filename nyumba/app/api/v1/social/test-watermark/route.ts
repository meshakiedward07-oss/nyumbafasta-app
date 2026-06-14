/**
 * POST /api/v1/social/test-watermark
 * Admin-only endpoint to verify watermark URL transformation is working.
 *
 * Body: { imageUrl?: string; videoUrl?: string }
 * At least one must be provided.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { watermarkImage, isCloudinaryUrl } from '@/lib/media/watermark'
import { watermarkVideo, isCloudinaryVideoUrl } from '@/lib/media/videoWatermark'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { imageUrl?: string; videoUrl?: string }
  const { imageUrl, videoUrl } = body

  if (!imageUrl && !videoUrl) {
    return NextResponse.json(
      { error: 'Toa imageUrl au videoUrl kwenye body' },
      { status: 400 },
    )
  }

  const results: Record<string, unknown> = {}

  if (imageUrl) {
    const isCloud = isCloudinaryUrl(imageUrl)
    const watermarked = await watermarkImage(imageUrl)
    results.image = {
      original:    imageUrl,
      watermarked,
      applied:     watermarked !== imageUrl,
      method:      isCloud ? 'cloudinary_url_transform' : 'sharp_composite',
    }
    console.log('[Watermark] Test image result:', results.image)
  }

  if (videoUrl) {
    const isCloud = isCloudinaryVideoUrl(videoUrl)
    const watermarked = watermarkVideo(videoUrl)
    results.video = {
      original:    videoUrl,
      watermarked,
      applied:     watermarked !== videoUrl,
      method:      isCloud ? 'cloudinary_url_transform' : 'none_no_ffmpeg',
    }
    console.log('[Watermark] Test video result:', results.video)
  }

  const allApplied = Object.values(results).every(
    (r) => (r as { applied: boolean }).applied,
  )

  return NextResponse.json({
    ok: allApplied,
    results,
    message: allApplied
      ? 'Watermark zote zimefanikiwa ✅'
      : 'Baadhi ya watermarks hazikufanya kazi ❌ — angalia logs',
  })
}
