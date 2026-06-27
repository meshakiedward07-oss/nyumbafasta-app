'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { VideoPlayer } from '@/components/listings/VideoPlayer'

// ── Types ──────────────────────────────────────────────────────────────────

type UploadState =
  | 'idle'
  | 'selected'
  | 'uploading'
  | 'uploaded'
  | 'generating'
  | 'posting'
  | 'posted'
  | 'error'

type VideoType = 'promotion' | 'listing_tour' | 'announcement' | 'testimonial' | 'other'

type PlatformStatus = {
  instagram: 'idle' | 'posting' | 'processing' | 'done' | 'error'
  facebook:  'idle' | 'posting' | 'done' | 'error'
}

type VideoRecord = {
  id:           string
  title:        string
  video_type:   string
  post_status:  string
  platforms:    string[]
  ig_post_id:   string | null
  fb_post_id:   string | null
  error_message:string | null
  created_at:   string
  posted_at:    string | null
}

const CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'daw8jlbbd'
const PRESET = 'nyumba_listings'

const VIDEO_TYPES: { value: VideoType; label: string; emoji: string }[] = [
  { value: 'promotion',    label: 'Matangazo',     emoji: '📢' },
  { value: 'listing_tour', label: 'Ziara ya Nyumba', emoji: '🏠' },
  { value: 'announcement', label: 'Tangazo',        emoji: '📣' },
  { value: 'testimonial',  label: 'Ushuhuda',       emoji: '⭐' },
  { value: 'other',        label: 'Nyingine',       emoji: '🎬' },
]

const MAX_SIZE_BYTES   = 500 * 1024 * 1024  // 500MB
const IG_WARN_BYTES    = 100 * 1024 * 1024  // 100MB — warn for IG
const ALLOWED_TYPES    = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo']
const ALLOWED_EXT_MSG  = 'MP4, MOV, AVI'

function formatBytes(b: number) {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (b >= 1024 * 1024)        return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    posted:    'bg-green-100 text-green-700',
    posting:   'bg-blue-100 text-blue-700',
    scheduled: 'bg-yellow-100 text-yellow-700',
    draft:     'bg-gray-100 text-gray-600',
    failed:    'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    posted: 'Imechapishwa', posting: 'Inachapisha',
    scheduled: 'Imepangwa', draft: 'Rasimu', failed: 'Imeshindwa',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function VideoUploadTab() {
  const [state, setState]     = useState<UploadState>('idle')
  const [file, setFile]       = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)

  // Form
  const [title, setTitle]           = useState('')
  const [description, setDescription] = useState('')
  const [videoType, setVideoType]   = useState<VideoType>('promotion')
  const [igEnabled, setIgEnabled]   = useState(true)
  const [fbEnabled, setFbEnabled]   = useState(true)
  const [captionIg, setCaptionIg]   = useState('')
  const [captionFb, setCaptionFb]   = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduleMode, setScheduleMode] = useState(false)

  // Status tracking
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({
    instagram: 'idle', facebook: 'idle',
  })
  const [toast, setToast]     = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  // History
  const [history, setHistory]     = useState<VideoRecord[]>([])
  const [histLoading, setHistLoading] = useState(false)

  const dropRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setHistLoading(true)
    try {
      const res  = await fetch('/api/v1/social/video')
      const data = await res.json() as { videos?: VideoRecord[] }
      setHistory(data.videos ?? [])
    } catch { /* silent */ } finally {
      setHistLoading(false)
    }
  }

  // ── File selection ─────────────────────────────────────────────────────

  function validateFile(f: File): string | null {
    if (!ALLOWED_TYPES.includes(f.type) && !f.name.match(/\.(mp4|mov|avi|MOV|MP4|AVI)$/)) {
      return `Aina hii haikusubaliwa. Tumia ${ALLOWED_EXT_MSG}`
    }
    if (f.size > MAX_SIZE_BYTES) {
      return `Faili ni kubwa mno (${formatBytes(f.size)}). Ukubwa wa juu: 500MB`
    }
    return null
  }

  const pickFile = useCallback((f: File) => {
    const err = validateFile(f)
    if (err) { setError(err); return }
    setError(null)
    setWarnings(f.size > IG_WARN_BYTES ? ['Faili ni kubwa kwa Instagram (zaidi ya 100MB). Instagram itajaribu lakini inaweza kushindwa.'] : [])
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
    setState('selected')

    // Detect video duration
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => {
      setDuration(Math.round(vid.duration))
      URL.revokeObjectURL(vid.src)
    }
    vid.src = url
  }, [])

  // Drag and drop
  useEffect(() => {
    const el = dropRef.current
    if (!el) return

    function onDragOver(e: DragEvent) {
      e.preventDefault()
      if (!dragging.current) { dragging.current = true; el!.classList.add('border-primary-500', 'bg-primary-500/5') }
    }
    function onDragLeave() {
      dragging.current = false; el!.classList.remove('border-primary-500', 'bg-primary-500/5')
    }
    function onDrop(e: DragEvent) {
      e.preventDefault(); onDragLeave()
      const f = e.dataTransfer?.files[0]
      if (f) pickFile(f)
    }

    el.addEventListener('dragover', onDragOver)
    el.addEventListener('dragleave', onDragLeave)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('dragleave', onDragLeave)
      el.removeEventListener('drop', onDrop)
    }
  }, [pickFile])

  // ── Cloudinary upload (XHR for progress) ──────────────────────────────

  async function handleUpload() {
    if (!file || !title.trim()) {
      setError('Andika kichwa cha video kwanza')
      return
    }
    if (duration !== null && duration < 3) {
      setError('Video lazima iwe angalau sekunde 3')
      return
    }

    setState('uploading')
    setProgress(0)
    setError(null)

    try {
      const cloudUrl = await uploadToCloudinary(file, setProgress)

      // Save to DB
      const res  = await fetch('/api/v1/social/video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          videoUrl:    cloudUrl,
          title:       title.trim(),
          description: description.trim() || undefined,
          videoType,
          fileSize:    file.size,
        }),
      })
      const data = await res.json() as { ok?: boolean; videoId?: string; error?: string }
      if (data.error) throw new Error(data.error)

      setVideoId(data.videoId ?? null)
      setVideoUrl(cloudUrl)
      setState('uploaded')
      showToast('Video imepakiwa! Sasa ongeza caption na uchague platforms.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload ilishindwa. Jaribu tena.')
      setState('selected')
    }
  }

  function uploadToCloudinary(f: File, onProgress: (p: number) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('upload_preset', PRESET)
      fd.append('folder', 'nyumba/social-videos')

      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        try {
          const d = JSON.parse(xhr.responseText) as { secure_url?: string; error?: { message: string } }
          if (d.secure_url) resolve(d.secure_url)
          else reject(new Error(d.error?.message ?? 'Upload ilishindwa'))
        } catch { reject(new Error('Jibu baya kutoka Cloudinary')) }
      }
      xhr.onerror = () => reject(new Error('Hitilafu ya mtandao'))
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`)
      xhr.send(fd)
    })
  }

  // ── AI caption generation ──────────────────────────────────────────────

  async function handleGenerateCaption() {
    if (!title.trim()) { setError('Andika kichwa cha video kwanza'); return }
    setState('generating')
    setError(null)
    try {
      const res  = await fetch('/api/v1/social/video-caption', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title, videoType, description }),
      })
      const data = await res.json() as { instagram?: string; facebook?: string; error?: string }
      if (data.error) throw new Error(data.error)
      setCaptionIg(data.instagram ?? '')
      setCaptionFb(data.facebook  ?? '')
      showToast('Caption imetengenezwa na AI!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutengeneza caption')
    } finally {
      setState('uploaded')
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!videoId) { setError('Pakia video kwanza'); return }
    if (!igEnabled && !fbEnabled) { setError('Chagua angalau jukwaa moja'); return }
    if (igEnabled && !captionIg.trim()) { setError('Andika caption ya Instagram'); return }
    if (fbEnabled && !captionFb.trim()) { setError('Andika caption ya Facebook'); return }

    setState('posting')
    setError(null)
    setWarnings([])

    const platforms: string[] = []
    if (igEnabled) platforms.push('instagram')
    if (fbEnabled) platforms.push('facebook')

    // Optimistic platform status
    setPlatformStatus({
      instagram: igEnabled ? 'posting' : 'idle',
      facebook:  fbEnabled ? 'posting' : 'idle',
    })

    try {
      const res  = await fetch(`/api/v1/social/video/${videoId}/publish`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          platforms,
          captionIg,
          captionFb,
          scheduledAt: scheduleMode && scheduledAt ? scheduledAt : undefined,
        }),
      })
      const data = await res.json() as {
        ok?: boolean; scheduled?: boolean
        igPostId?: string; fbPostId?: string
        warnings?: string[]; error?: string
      }

      if (data.error) throw new Error(data.error)

      if (data.scheduled) {
        showToast('Video imepangwa kwa mafanikio!')
        setState('uploaded')
      } else {
        setPlatformStatus({
          instagram: data.igPostId ? 'done' : igEnabled ? 'error' : 'idle',
          facebook:  data.fbPostId ? 'done' : fbEnabled ? 'error' : 'idle',
        })
        if (data.warnings?.length) setWarnings(data.warnings)
        setState('posted')
        showToast('Video imechapishwa kwenye mitandao ya kijamii!')
        loadHistory()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuchapisha kumeshindwa. Jaribu tena.')
      setPlatformStatus({ instagram: 'idle', facebook: 'idle' })
      setState('uploaded')
    }
  }

  function handleReset() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null); setDuration(null)
    setTitle(''); setDescription(''); setVideoType('promotion')
    setCaptionIg(''); setCaptionFb(''); setScheduledAt(''); setScheduleMode(false)
    setVideoId(null); setVideoUrl(null)
    setProgress(0); setError(null); setWarnings([])
    setPlatformStatus({ instagram: 'idle', facebook: 'idle' })
    setState('idle')
  }

  const isPosting = state === 'posting'
  const isUploading = state === 'uploading'

  function getPublishBlocker(): string | null {
    if (!file && !videoId) return 'Chagua video kwanza'
    if (!videoId) return 'Bonyeza "Pakia Video" kwanza'
    if (!igEnabled && !fbEnabled) return 'Chagua angalau jukwaa moja'
    if (igEnabled && !captionIg.trim()) return 'Andika caption ya Instagram'
    if (fbEnabled && !captionFb.trim()) return 'Andika caption ya Facebook'
    return null
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-xs">
          {toast}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── LEFT: Upload + Form ── */}
        <div className="space-y-4">

          {/* Drop zone */}
          {state === 'idle' || state === 'selected' || state === 'uploading' ? (
            <div
              ref={dropRef}
              onClick={() => state !== 'uploading' && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer
                ${state === 'uploading' ? 'cursor-default opacity-70 border-gray-200' : 'hover:border-primary-500 hover:bg-primary-500/5 border-gray-300'}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/avi,.mp4,.mov,.avi"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
              />

              {state === 'uploading' ? (
                <div className="space-y-3">
                  <div className="text-3xl">⏫</div>
                  <p className="font-semibold text-gray-700">Inapakia video...</p>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500">{progress}%</p>
                </div>
              ) : file ? (
                <div className="space-y-2">
                  <div className="text-3xl">🎬</div>
                  <p className="font-semibold text-gray-800 truncate">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatBytes(file.size)}
                    {duration !== null && ` • ${duration}s`}
                  </p>
                  <p className="text-xs text-primary-500">Click kubadilisha faili</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-5xl">📹</div>
                  <p className="font-semibold text-gray-700 text-lg">Pakia Video Yako</p>
                  <p className="text-sm text-gray-400">Buruta video hapa au click kupakia</p>
                  <p className="text-xs text-gray-400">Aina zinazokubalika: {ALLOWED_EXT_MSG} • Max: 500MB</p>
                </div>
              )}
            </div>
          ) : (
            /* Video preview after upload — streamed via VideoPlayer (same as dalali/client) */
            <div className="relative">
              <VideoPlayer
                src={videoUrl ?? preview ?? ''}
                title="Preview ya Video"
              />
              {/* Watermark preview pill — mirrors Cloudinary overlay position (bottom-center) */}
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none select-none z-20">
                <div className="bg-black/70 rounded-2xl px-3 py-1.5 flex flex-col items-center">
                  <span className="text-white/80 text-[9px] font-semibold tracking-wide leading-none">NyumbaFasta</span>
                  <span className="text-white text-xs font-bold leading-tight">nyumbafasta.co</span>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 z-20"
              >
                ✕ Video Mpya
              </button>
            </div>
          )}

          {/* Warnings */}
          {warnings.map((w, i) => (
            <div key={i} className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              <span>⚠️</span><span>{w}</span>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <span>❌</span><span>{error}</span>
            </div>
          )}

          {/* Title + Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Kichwa cha Video <span className="text-red-500">*</span>
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="mfano: Promotion ya Mbezi Beach Apartments"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isUploading || isPosting}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Maelezo (hiari)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Maelezo mafupi ya video"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isUploading || isPosting}
              />
            </div>

            {/* Video type */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Aina ya Video</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setVideoType(t.value)}
                    disabled={isUploading || isPosting}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                      videoType === t.value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span>{t.emoji}</span><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Upload button */}
          {(state === 'selected') && (
            <button
              onClick={handleUpload}
              disabled={!file || !title.trim()}
              className="btn-primary w-full py-3"
            >
              ⬆️ Pakia Video
            </button>
          )}

          {/* Reset */}
          {(state === 'posted' || state === 'error') && (
            <button
              onClick={handleReset}
              className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50"
            >
              + Pakia Video Mpya
            </button>
          )}
        </div>

        {/* ── RIGHT: Platforms + Captions + Publish ── */}
        <div className="space-y-4">

          {/* Platform selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Chapisha Kwenye</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={igEnabled}
                  onChange={(e) => setIgEnabled(e.target.checked)}
                  disabled={isPosting}
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">📸 Instagram Reels</span>
                {platformStatus.instagram !== 'idle' && (
                  <PlatStatusChip status={platformStatus.instagram} />
                )}
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fbEnabled}
                  onChange={(e) => setFbEnabled(e.target.checked)}
                  disabled={isPosting}
                  className="w-4 h-4 accent-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">👤 Facebook Video</span>
                {platformStatus.facebook !== 'idle' && (
                  <PlatStatusChip status={platformStatus.facebook} />
                )}
              </label>
            </div>
          </div>

          {/* Captions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Captions</p>
              <button
                onClick={handleGenerateCaption}
                disabled={!title.trim() || state === 'generating' || isPosting || isUploading}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
              >
                {state === 'generating' ? (
                  <>
                    <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    Amina anaandika...
                  </>
                ) : (
                  '✨ Tengeneza kwa AI'
                )}
              </button>
            </div>

            {igEnabled && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">📸 Instagram</label>
                  <span className="text-xs text-gray-400">{captionIg.length}/2200</span>
                </div>
                <textarea
                  value={captionIg}
                  onChange={(e) => setCaptionIg(e.target.value.slice(0, 2200))}
                  rows={5}
                  disabled={isPosting || isUploading}
                  placeholder="Caption + hashtags za Instagram..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            )}

            {fbEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">👤 Facebook</label>
                <textarea
                  value={captionFb}
                  onChange={(e) => setCaptionFb(e.target.value.slice(0, 5000))}
                  rows={4}
                  disabled={isPosting || isUploading}
                  placeholder="Caption ya Facebook..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
            )}
          </div>

          {/* Schedule or post now */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Wakati wa Kuchapisha</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!scheduleMode}
                  onChange={() => setScheduleMode(false)}
                  className="accent-primary-500"
                  disabled={isPosting}
                />
                <span className="text-sm text-gray-700">Sasa Hivi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={scheduleMode}
                  onChange={() => setScheduleMode(true)}
                  className="accent-primary-500"
                  disabled={isPosting}
                />
                <span className="text-sm text-gray-700">Panga Ratiba</span>
              </label>
            </div>
            {scheduleMode && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={isPosting}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
          </div>

          {/* Publish button — always visible */}
          {(() => {
            const blocker = getPublishBlocker()
            const disabled = !!blocker || isPosting || isUploading
            return (
              <div className="space-y-1.5">
                <button
                  onClick={handlePublish}
                  disabled={disabled}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {isPosting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Inachapisha... (Instagram inaweza kuchukua dakika 1–3)
                    </>
                  ) : scheduleMode ? '📅 Panga Ratiba' : '🚀 Chapisha Sasa'}
                </button>
                {blocker && !isPosting && (
                  <p className="text-xs text-center text-gray-400">{blocker}</p>
                )}
              </div>
            )
          })()}

          {/* Success state */}
          {state === 'posted' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-green-800">✅ Video imechapishwa!</p>
              {platformStatus.instagram === 'done' && (
                <p className="text-xs text-green-700">📸 Instagram Reel: imefanikiwa</p>
              )}
              {platformStatus.facebook === 'done' && (
                <p className="text-xs text-green-700">👤 Facebook Video: imefanikiwa</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Video History ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">📋 Video Zilizopita</h3>
          <button
            onClick={loadHistory}
            disabled={histLoading}
            className="text-xs text-primary-500 hover:underline disabled:opacity-50"
          >
            {histLoading ? 'Inapakia...' : '🔄 Refresh'}
          </button>
        </div>

        {histLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2">🎬</div>
            <p className="text-sm">Hakuna video zilizopakiwa bado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <span className="text-2xl flex-shrink-0">
                  {VIDEO_TYPES.find(t => t.value === v.video_type)?.emoji ?? '🎬'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{v.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StatusBadge status={v.post_status} />
                    {v.platforms?.length > 0 && (
                      <span className="text-xs text-gray-400">{v.platforms.join(', ')}</span>
                    )}
                    <span className="text-xs text-gray-400">{fmtDate(v.created_at)}</span>
                  </div>
                  {v.error_message && (
                    <p className="text-xs text-red-500 mt-0.5 truncate">{v.error_message}</p>
                  )}
                </div>
                {v.post_status === 'draft' && (
                  <button
                    onClick={() => {
                      setVideoId(v.id)
                      setVideoUrl(null)
                      setState('uploaded')
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className="text-xs px-2 py-1 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex-shrink-0"
                  >
                    Chapisha
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PlatStatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    posting:    { cls: 'bg-blue-100 text-blue-700',   label: 'Inatuma...' },
    processing: { cls: 'bg-yellow-100 text-yellow-700', label: 'Inasindika...' },
    done:       { cls: 'bg-green-100 text-green-700',  label: '✓ Imefanikiwa' },
    error:      { cls: 'bg-red-100 text-red-700',      label: '✗ Imeshindwa' },
  }
  const s = map[status]
  if (!s) return null
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}
