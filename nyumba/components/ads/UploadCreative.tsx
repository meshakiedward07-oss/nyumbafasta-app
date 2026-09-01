'use client'
import Image from 'next/image'
import { useState, useRef, useCallback } from 'react'
import { useLanguage } from '@/lib/i18n/context'

type Creative = {
  id: string
  media_type: 'image' | 'video' | 'carousel'
  banner_url:      string | null
  search_url:      string | null
  nearby_url:      string | null
  featured_url:    string | null
  video_thumb_url: string | null
  video_url:       string | null
  carousel_urls:   string[] | null
  processing_status: 'pending' | 'processing' | 'done' | 'failed'
  error_message:   string | null
}

type Props = {
  campaignId: string
  onDone?: (creative: Creative) => void
  onSkip?: () => void
}

const PREVIEW_VARIANTS = [
  { key: 'banner_url',    label: 'Banner (1200×400)',   w: 240, h: 80  },
  { key: 'nearby_url',   label: 'Nearby (300×200)',    w: 150, h: 100 },
  { key: 'featured_url', label: 'Featured (800×450)',  w: 160, h: 90  },
] as const

// Matches what's advertised in adv_file_size_hint. Checked client-side,
// before any network call — previously a file of any size was attempted
// regardless, so a grossly-oversized video would run for a while and then
// die with a bare, unhelpful browser "Failed to fetch" instead of an
// immediate, clear reason. Found 2026-09-01.
//
// 50MB / 30s (not the earlier 100MB) — deliberately tight limits to
// protect the system: unbounded ad-video size/length costs real Cloudinary
// storage+bandwidth and page-load weight for every visitor who sees the
// ad. Requested 2026-09-01. Also enforced server-side in
// lib/ads/creative.ts (this client check is just fast feedback — a direct
// API call can't bypass the real limit).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 30

// Reads a video file's duration client-side via a throwaway <video> element
// — no upload needed, just enough of the file for the browser to parse
// metadata. Rejects if the browser can't read it (corrupt/unsupported file)
// so the caller can decide whether to block or let the server have the
// final say.
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('duration read failed'))
    }
    video.src = URL.createObjectURL(file)
  })
}

export default function UploadCreative({ campaignId, onDone, onSkip }: Props) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)

  const [files,    setFiles]    = useState<File[]>([])
  const [preview,  setPreview]  = useState<string | null>(null)   // first file object URL
  const [creative, setCreative] = useState<Creative | null>(null)
  const [warning,  setWarning]  = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [phase, setPhase]       = useState<'idle' | 'uploading' | 'done' | 'failed'>('idle')
  const [progress, setProgress] = useState(0)

  const isVideo = files[0]?.type.startsWith('video/')

  // ── File selection ────────────────────────────────────────────────────────

  const handleFiles = useCallback(async (selected: FileList | null) => {
    if (!selected || selected.length === 0) return
    const arr = Array.from(selected)

    const isVid    = arr[0].type.startsWith('video/')
    const maxBytes = isVid ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    const oversized = arr.find(f => f.size > maxBytes)
    if (oversized) {
      const mb = (oversized.size / (1024 * 1024)).toFixed(1)
      setError((isVid ? t('adv_video_too_large') : t('adv_image_too_large')).replace('{{mb}}', mb))
      setWarning(null)
      setCreative(null)
      setPhase('idle')
      return
    }

    // Duration check — video only, hard rejection (no continue-anyway):
    // there's no legitimate reason for an ad video to exceed 30s, and this
    // protects the system from Cloudinary storage/bandwidth cost and heavy
    // page-load weight for every visitor who later sees the ad. If the
    // browser can't read the duration at all, don't block here — the
    // server-side check in lib/ads/creative.ts has the final say.
    if (isVid) {
      try {
        const duration = await getVideoDuration(arr[0])
        if (duration > MAX_VIDEO_DURATION_SECONDS) {
          setError(t('adv_video_too_long').replace('{{sec}}', String(Math.round(duration))))
          setWarning(null)
          setCreative(null)
          setPhase('idle')
          return
        }
      } catch { /* unreadable client-side — let the server validate it */ }
    }

    setFiles(arr)
    setWarning(null)
    setError(null)
    setCreative(null)
    setPhase('idle')

    // Preview: first file
    const url = URL.createObjectURL(arr[0])
    setPreview(url)
  }, [t])

  // ── Upload ────────────────────────────────────────────────────────────────
  // Uses a two-step signed-URL flow to bypass Vercel's 4.5 MB request body limit:
  //   1. GET /sign  → Supabase signed upload URL + path
  //   2. PUT file   → upload directly to Supabase Storage (no Vercel proxy)
  //   3. POST /creative with JSON { mode:'presigned', path, mimeType } → server processes

  async function upload(force = false) {
    if (files.length === 0) return
    setPhase('uploading')
    setError(null)
    setWarning(null)

    const controller = new AbortController()
    // Abort after 270s so user gets a clear message before Vercel's 300s hard kill
    const timeoutId  = setTimeout(() => controller.abort(), 270_000)

    try {
      const firstFile = files[0]
      const isVideo   = firstFile.type.startsWith('video/')

      // NOTE: there used to be a "Step 1" here that sent the raw image
      // directly to this Vercel API route (multipart, labelled checkOnly)
      // purely to get an early ratio-mismatch warning before the real
      // upload. It was mislabelled "cheap, no upload yet" — it actually
      // sent the full file over the network to Vercel, which has a hard
      // 4.5MB request-body ceiling at the platform level (no maxDuration
      // setting can raise it). Any phone-camera photo between 4.5-10MB
      // (very common — this app's own limit is 10MB) would hang or fail
      // against that ceiling well before our code ever ran, surfacing as
      // exactly the "imechukua muda mrefu sana" timeout a real advertiser
      // hit in production. It was also fully redundant: handlePresigned()
      // below already performs this identical ratio check (checkImageRatio)
      // server-side, after the file reaches Supabase Storage via the
      // presigned-URL path that was specifically built to avoid Vercel's
      // body-size limit — so removing this step loses no functionality,
      // it just means a bad-ratio warning now arrives after the (fast,
      // direct-to-Storage) upload instead of before it.

      // ── Step 2: get signed upload URL from server ────────────────────────
      setProgress(10)
      const signRes = await fetch(
        `/api/v1/advertising/campaigns/${campaignId}/creative/sign` +
        `?mimeType=${encodeURIComponent(firstFile.type)}&count=${files.length}`,
        { signal: controller.signal },
      )
      if (!signRes.ok) {
        const d = await signRes.json().catch(() => ({}))
        throw new Error(d.error ?? t('adv_sign_error'))
      }
      const { uploads } = await signRes.json() as {
        uploads: { signedUrl: string; token: string; path: string }[]
      }

      // ── Step 3: upload each file directly to Supabase Storage ───────────
      const paths: string[] = []
      for (let i = 0; i < files.length; i++) {
        setProgress(15 + Math.round((i / files.length) * 55))
        const { signedUrl, path } = uploads[i]
        const putRes = await fetch(signedUrl, {
          method:  'PUT',
          headers: { 'Content-Type': files[i].type, 'x-upsert': 'true' },
          body:    files[i],
          signal:  controller.signal,
        })
        if (!putRes.ok) {
          // Supabase Storage's error responses carry the real reason
          // (mime type rejected, file too large, expired token, etc.) in
          // the JSON body — only the numeric status was ever surfaced
          // before, which wasn't enough to diagnose a real 400. Read it,
          // best-effort, without letting a non-JSON body break the flow.
          let detail = ''
          try {
            const body = await putRes.json()
            detail = body?.message || body?.error || ''
          } catch { /* body wasn't JSON — status code is all we have */ }
          const base = t('adv_upload_file_error').replace('{n}', String(i + 1)).replace('{s}', String(putRes.status))
          throw new Error(detail ? `${base} — ${detail}` : base)
        }
        paths.push(path)
      }

      // ── Step 4: tell server to process the uploaded file(s) ──────────────
      setProgress(75)
      const processRes = await fetch(
        `/api/v1/advertising/campaigns/${campaignId}/creative`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            mode:     'presigned',
            paths,
            mimeType: firstFile.type,
            force,
          }),
          signal: controller.signal,
        },
      )
      // Server processing (Storage download → Cloudinary upload → transcode
      // for videos) can be genuinely slow for large files; if it ever
      // outruns Vercel's own function time limit, the platform kills the
      // function mid-response and the browser gets a body-less response —
      // calling .json() on that throws a cryptic "Unexpected end of JSON
      // input" instead of a message anyone could act on. Parse defensively
      // so that failure mode gets the same clear Swahili message as an
      // actual timeout, regardless of which one it technically was.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any
      try {
        data = await processRes.json()
      } catch {
        throw new Error(t('adv_timeout_hint'))
      }
      setProgress(95)

      if (!processRes.ok) {
        if (data.warning) {
          setWarning(data.message)
          setPhase('idle')
          setProgress(0)
          return
        }
        const msg = data.error ?? t('adv_generic_error')
        const detail = data.detail ? ` (${data.detail})` : ''
        setError(msg + detail)
        setPhase('failed')
        return
      }

      setCreative(data.creative)
      setPhase('done')
      setProgress(100)
      onDone?.(data.creative)

    } catch (e) {
      const isAbort = e instanceof Error && e.name === 'AbortError'
      // A bare browser network error (fetch() itself rejecting, not any of
      // the specific Swahili errors thrown above) shows as one of these
      // opaque, browser-specific strings with zero diagnostic value —
      // "Failed to fetch" (Chrome/Edge), "NetworkError when attempting to
      // fetch resource." (Firefox), "Load failed" (Safari). Most commonly
      // hit mid-PUT on a large video: either the connection genuinely died,
      // or — just as likely given this app's own size limits have needed
      // fixing more than once — the file exceeded what Supabase Storage's
      // project-wide upload cap actually allows right now, which can kill
      // the connection outright instead of returning a clean 400 for a
      // sufficiently large file. Found 2026-09-01.
      const isOpaqueNetworkError = e instanceof Error && (
        e.message === 'Failed to fetch' ||
        e.message.startsWith('NetworkError') ||
        e.message === 'Load failed'
      )
      const message = isAbort
        ? t('adv_timeout_hint')
        : isOpaqueNetworkError
          ? t('adv_failed_to_fetch_hint')
          : e instanceof Error && e.message
            ? e.message
            : t('adv_network_check')
      setError(message)
      setPhase('failed')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'done' && creative) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-xl">✅</span>
          <div>
            <p className="font-bold text-sm">{t('adv_creative_uploaded')}</p>
            <p className="text-xs text-green-600">{t('adv_creative_all_formats')}</p>
          </div>
        </div>

        {/* Variant previews */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {t('adv_creative_formats_title')}
          </p>
          {PREVIEW_VARIANTS.map(v => {
            const url = creative[v.key]
            if (!url) return null
            return (
              <div key={v.key} className="flex items-center gap-3">
                <div
                  className="relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
                  style={{ width: v.w, height: v.h }}
                >
                  <Image src={url} alt={v.label} fill className="object-cover" sizes={`${v.w}px`} />
                </div>
                <span className="text-xs text-gray-500">{v.label}</span>
              </div>
            )
          })}

          {creative.video_thumb_url && creative.media_type === 'video' && (
            <div className="flex items-center gap-3">
              <div className="relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0" style={{ width: 160, height: 90 }}>
                <Image src={creative.video_thumb_url} alt="Video thumbnail" fill className="object-cover" sizes="160px" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl">▶️</span>
                </div>
              </div>
              <span className="text-xs text-gray-500">Video Thumbnail (640×360)</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
          files.length > 0
            ? 'border-primary-300 bg-primary-50'
            : 'border-gray-300 hover:border-primary-300 hover:bg-gray-50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={e => handleFiles(e.target.files)}
        />

        {preview && files.length > 0 ? (
          <div className="space-y-2">
            {isVideo ? (
              <div className="flex justify-center">
                <video
                  src={preview}
                  className="max-h-32 rounded-xl"
                  muted
                  playsInline
                />
              </div>
            ) : (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" className="max-h-32 rounded-xl object-contain" />
              </div>
            )}
            <p className="text-xs text-gray-500">
              {files.length > 1
                ? t('adv_images_selected').replace('{n}', String(files.length))
                : files[0].name}
              {' '}<button
                onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                className="text-primary-600 underline"
              >
                {t('adv_change')}
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className="text-3xl mb-2">🖼️</p>
            <p className="text-sm font-medium text-gray-700">{t('adv_drop_or_click')}</p>
            <p className="text-xs text-gray-400 mt-1">
              {t('adv_file_types_hint')}
            </p>
            <p className="text-xs text-gray-400">{t('adv_file_size_hint')}</p>
          </>
        )}
      </div>

      {/* Portrait warning */}
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <p className="font-bold text-amber-800 mb-1">⚠️ {t('adv_portrait_warning')}</p>
          <p className="text-amber-700 text-xs">{warning}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => upload(true)}
              className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition"
            >
              {t('adv_continue_anyway')}
            </button>
            <button
              onClick={() => { setFiles([]); setPreview(null); setWarning(null) }}
              className="text-xs border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
            >
              {t('adv_choose_other_image')}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload progress */}
      {phase === 'uploading' && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{t('adv_processing')}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {t('adv_formats_processing')}
          </p>
        </div>
      )}

      {/* Action buttons */}
      {phase !== 'uploading' && (
        <div className="flex gap-3">
          <button
            onClick={() => upload(false)}
            disabled={files.length === 0}
            className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-primary-600 transition disabled:opacity-40"
          >
            {t('adv_upload_btn')}
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="border border-gray-200 text-gray-500 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              {t('adv_skip')}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        {t('adv_upload_tip')}
      </p>
    </div>
  )
}
