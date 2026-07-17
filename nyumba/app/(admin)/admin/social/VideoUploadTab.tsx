'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { VideoPlayer } from '@/components/listings/VideoPlayer'
import { PlatformLogo } from '@/components/shared/PlatformLogo'
import { compressVideo, canCompress } from '@/lib/video/compress'

// ── Types ──────────────────────────────────────────────────────────────────

type UploadState =
  | 'idle'
  | 'selected'
  | 'compressing'
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
  id:            string
  title:         string
  video_type:    string
  video_url:     string | null
  post_status:   string
  platforms:     string[]
  ig_post_id:    string | null
  fb_post_id:    string | null
  error_message: string | null
  created_at:    string
  posted_at:     string | null
}

type ConnectionResult = {
  ok: boolean
  instagram: { ok: boolean; name?: string; error?: string; scopes?: string[] }
  facebook:  { ok: boolean; name?: string; error?: string }
}

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'daw8jlbbd'

const VIDEO_TYPES: { value: VideoType; label: string; icon: string }[] = [
  { value: 'promotion',    label: 'Matangazo',       icon: 'speakerphone' },
  { value: 'listing_tour', label: 'Ziara ya Nyumba', icon: 'home' },
  { value: 'announcement', label: 'Tangazo',          icon: 'bell-ringing' },
  { value: 'testimonial',  label: 'Ushuhuda',         icon: 'star' },
  { value: 'other',        label: 'Nyingine',          icon: 'video' },
]

// Compress files > 30 MB before uploading to avoid Cloudinary timeouts
const COMPRESS_THRESHOLD = 30 * 1024 * 1024
const MAX_SIZE_BYTES     = 500 * 1024 * 1024
const ALLOWED_TYPES      = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo', 'video/webm']
const ALLOWED_EXT_MSG    = 'MP4, MOV, AVI, WebM'

function formatBytes(b: number) {
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (b >= 1024 * 1024)        return `${(b / (1024 * 1024)).toFixed(1)} MB`
  return `${(b / 1024).toFixed(0)} KB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function downloadVideo(url: string, filename: string) {
  let href = url
  if (url.includes('cloudinary.com') && url.includes('/upload/')) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    href = url.replace('/upload/', `/upload/fl_attachment:${safeName}/`)
  }
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
  const [state, setState]         = useState<UploadState>('idle')
  const [file, setFile]           = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [compressProgress, setCompressProgress] = useState(0)
  const [compressInfo, setCompressInfo] = useState<{ originalMB: number; compressedMB: number } | null>(null)
  const [videoId, setVideoId]     = useState<string | null>(null)
  const [videoUrl, setVideoUrl]   = useState<string | null>(null)
  const [duration, setDuration]   = useState<number | null>(null)
  const [hasAudio, setHasAudio]   = useState<boolean | null>(null)

  // Form
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [videoType, setVideoType]     = useState<VideoType>('promotion')
  const [captionIg, setCaptionIg]     = useState('')
  const [captionFb, setCaptionFb]     = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduleMode, setScheduleMode] = useState(false)

  // Status
  const [publishingFor, setPublishingFor]   = useState<string[] | null>(null)
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus>({
    instagram: 'idle', facebook: 'idle',
  })
  const [toast, setToast]     = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  // Connection test
  const [connResult, setConnResult]   = useState<ConnectionResult | null>(null)
  const [connTesting, setConnTesting] = useState(false)

  // History
  const [history,     setHistory]     = useState<VideoRecord[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  const dropRef  = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragging = useRef(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 6000)
  }

  useEffect(() => { loadHistory() }, [])

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

  async function handleTestConnection() {
    setConnTesting(true)
    setConnResult(null)
    try {
      const res  = await fetch('/api/v1/social/video/test-connection')
      const data = await res.json() as ConnectionResult
      setConnResult(data)
    } catch {
      setConnResult({ ok: false, instagram: { ok: false, error: 'Hitilafu ya seva' }, facebook: { ok: false, error: 'Hitilafu ya seva' } })
    } finally {
      setConnTesting(false)
    }
  }

  // ── File selection ─────────────────────────────────────────────────────

  function validateFile(f: File): string | null {
    const byType = ALLOWED_TYPES.includes(f.type)
    const byExt  = /\.(mp4|mov|avi|webm|MOV|MP4|AVI|WEBM)$/.test(f.name)
    if (!byType && !byExt) return `Aina hii haikusubaliwa. Tumia ${ALLOWED_EXT_MSG}`
    if (f.size > MAX_SIZE_BYTES) return `Faili ni kubwa mno (${formatBytes(f.size)}). Max: 500MB`
    return null
  }

  // Detect audio tracks from the file
  async function detectAudio(f: File): Promise<boolean> {
    try {
      const url  = URL.createObjectURL(f)
      const vid  = document.createElement('video')
      vid.src    = url
      vid.preload = 'metadata'
      await new Promise<void>((res) => {
        vid.onloadedmetadata = () => res()
        vid.onerror = () => res()
        setTimeout(res, 3000)
      })
      const tracks = (vid as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks
      const hasTrack = tracks ? tracks.length > 0 : true
      URL.revokeObjectURL(url)
      vid.src = ''
      return hasTrack
    } catch {
      return true // assume yes if detection fails
    }
  }

  const pickFile = useCallback((f: File) => {
    const err = validateFile(f)
    if (err) { setError(err); return }
    setError(null)
    setCompressInfo(null)
    setHasAudio(null)

    const warns: string[] = []
    if (f.size > COMPRESS_THRESHOLD && !canCompress()) {
      warns.push('Video ni kubwa (>30MB) na kivinjari chako hakisaidii compression. Punguza ukubwa wa video au tumia kivinjari kingine (Chrome/Edge).')
    }
    setWarnings(warns)
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
    setState('selected')

    // Detect duration + audio tracks
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => { setDuration(Math.round(vid.duration)); URL.revokeObjectURL(vid.src) }
    vid.src = url

    detectAudio(f).then(has => setHasAudio(has))
  }, [])

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

  // ── Cloudinary upload ─────────────────────────────────────────────────

  async function handleUpload() {
    if (!file || !title.trim()) { setError('Andika kichwa cha video kwanza'); return }
    if (duration !== null && duration < 3) { setError('Video lazima iwe angalau sekunde 3'); return }

    setError(null)

    // ── Step 1: compress if file is large and browser supports it ─────────
    let fileToUpload = file
    if (file.size > COMPRESS_THRESHOLD && canCompress()) {
      setState('compressing')
      setCompressProgress(0)
      try {
        const result = await compressVideo(file, (pct) => setCompressProgress(pct))
        if (result.wasCompressed) {
          setCompressInfo({ originalMB: result.originalMB, compressedMB: result.compressedMB })
          fileToUpload = result.file

          // Update preview to compressed file blob
          if (preview) URL.revokeObjectURL(preview)
          const newPreviewUrl = URL.createObjectURL(result.file)
          setPreview(newPreviewUrl)
        }
      } catch {
        // Compression failed — continue with original
        setWarnings(prev => [...prev, 'Compression ilishindwa — inapakia video ya asili.'])
      }
    }

    // ── Step 2: upload to Cloudinary ─────────────────────────────────────
    setState('uploading')
    setUploadProgress(0)

    try {
      const cloudUrl = await uploadToCloudinary(fileToUpload, setUploadProgress)

      const res  = await fetch('/api/v1/social/video', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          videoUrl:    cloudUrl,
          title:       title.trim(),
          description: description.trim() || undefined,
          videoType,
          fileSize:    fileToUpload.size,
        }),
      })
      const data = await res.json() as { ok?: boolean; videoId?: string; error?: string }
      if (data.error) throw new Error(data.error)

      setVideoId(data.videoId ?? null)
      setVideoUrl(cloudUrl)
      setState('uploaded')
      showToast('✅ Video imepakiwa! Ongeza caption na uchague platform ya kuchapisha.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload ilishindwa. Jaribu tena.')
      setState('selected')
    }
  }

  async function uploadToCloudinary(f: File, onProgress: (p: number) => void): Promise<string> {
    const signRes = await fetch('/api/v1/social/video/upload-sign')
    if (!signRes.ok) {
      const err = await signRes.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? 'Imeshindwa kupata ruhusa ya kupakia')
    }
    const sign = await signRes.json() as {
      signature: string; timestamp: number; apiKey: string
      cloudName: string; folder: string; eager: string
    }

    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('api_key',            sign.apiKey)
      fd.append('timestamp',          String(sign.timestamp))
      fd.append('signature',          sign.signature)
      fd.append('folder',             sign.folder)
      fd.append('eager',              sign.eager)
      fd.append('resource_type',      'video')
      fd.append('signature_algorithm','sha256')

      const xhr = new XMLHttpRequest()
      xhr.timeout = 20 * 60 * 1000
      xhr.ontimeout = () => reject(new Error('Upload ilichukua muda mrefu sana. Jaribu faili ndogo au compresed.'))
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        try {
          const d = JSON.parse(xhr.responseText) as {
            secure_url?: string
            eager?: { secure_url: string }[]
            error?: { message: string }
          }
          if (d.error) { reject(new Error(d.error.message)); return }
          // Prefer eager (pre-generated watermarked) URL — already cached on Cloudinary CDN
          const url = d.eager?.[0]?.secure_url ?? d.secure_url
          if (url) resolve(url)
          else reject(new Error('Upload ilishindwa — jaribu tena'))
        } catch { reject(new Error('Jibu baya kutoka Cloudinary — jaribu tena')) }
      }
      xhr.onerror = () => reject(new Error('Hitilafu ya mtandao. Angalia muunganiko wako.'))
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`)
      xhr.send(fd)
    })
  }

  // ── AI caption ────────────────────────────────────────────────────────

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
      showToast('✅ Caption imetengenezwa na AI!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutengeneza caption')
    } finally {
      setState('uploaded')
    }
  }

  // ── Publish ───────────────────────────────────────────────────────────

  async function handlePublish(platforms: string[]) {
    if (!videoId) { setError('Pakia video kwanza'); return }
    if (platforms.includes('instagram') && !captionIg.trim()) {
      setError('Andika caption ya Instagram'); return
    }
    if (platforms.includes('facebook') && !captionFb.trim()) {
      setError('Andika caption ya Facebook'); return
    }

    setState('posting')
    setPublishingFor(platforms)
    setError(null)
    setWarnings([])
    setPlatformStatus({
      instagram: platforms.includes('instagram') ? 'posting' : 'idle',
      facebook:  platforms.includes('facebook')  ? 'posting' : 'idle',
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
        showToast('✅ Video imepangwa kwa mafanikio!')
        setState('uploaded')
      } else {
        setPlatformStatus({
          instagram: data.igPostId ? 'done' : platforms.includes('instagram') ? 'error' : 'idle',
          facebook:  data.fbPostId ? 'done' : platforms.includes('facebook')  ? 'error' : 'idle',
        })
        if (data.warnings?.length) setWarnings(data.warnings)
        setState('posted')
        showToast('✅ Video imechapishwa!')
        loadHistory()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kuchapisha kumeshindwa. Jaribu tena.')
      setPlatformStatus({ instagram: 'idle', facebook: 'idle' })
      setState('uploaded')
    } finally {
      setPublishingFor(null)
    }
  }

  function handleReset() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null); setPreview(null); setDuration(null); setHasAudio(null)
    setTitle(''); setDescription(''); setVideoType('promotion')
    setCaptionIg(''); setCaptionFb(''); setScheduledAt(''); setScheduleMode(false)
    setVideoId(null); setVideoUrl(null)
    setUploadProgress(0); setCompressProgress(0); setCompressInfo(null)
    setError(null); setWarnings([])
    setPlatformStatus({ instagram: 'idle', facebook: 'idle' })
    setPublishingFor(null)
    setState('idle')
  }

  const isPosting    = state === 'posting'
  const isUploading  = state === 'uploading'
  const isCompressing = state === 'compressing'
  const isBusy       = isPosting || isUploading || isCompressing
  const hasVideo     = !!videoId
  const showPreview  = state === 'uploaded' || state === 'generating' || state === 'posting' || state === 'posted' || state === 'error'

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl text-sm max-w-xs animate-fade-in">
          {toast}
        </div>
      )}

      {/* ── Connection test panel ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <i className="ti ti-wifi" /> Hali ya Muunganiko wa Meta
          </p>
          <button
            onClick={handleTestConnection}
            disabled={connTesting}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            {connTesting
              ? <><span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" /> Inajaribu...</>
              : <><i className="ti ti-refresh" /> Jaribu Muunganiko</>}
          </button>
        </div>
        {connResult ? (
          <div className="space-y-2">
            {(['instagram', 'facebook'] as const).map(p => (
              <div key={p} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${connResult[p].ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
                <PlatformLogo platform={p} size={14} />
                <div className="flex-1">
                  <span className="font-semibold capitalize">{p}</span>
                  {connResult[p].ok
                    ? <span> — {connResult[p].name} ✓ Muunganiko unafanya kazi</span>
                    : <span> — {connResult[p].error}</span>}
                </div>
                <i className={`ti ${connResult[p].ok ? 'ti-circle-check text-green-600' : 'ti-circle-x text-red-500'} text-base flex-shrink-0`} />
              </div>
            ))}
            {!connResult.ok && (
              <p className="text-xs text-gray-500 pt-1">
                Nenda Meta Business Suite → Settings → System Users → tengeneza token mpya ukiweke kwenye Vercel Environment Variables.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400">Bonyeza &quot;Jaribu Muunganiko&quot; kuthibitisha tokens za Instagram na Facebook.</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* ── LEFT: Upload + Preview + Form ── */}
        <div className="space-y-4">

          {/* ── Drop zone / Progress / Preview ── */}
          {!showPreview ? (
            <div
              ref={dropRef}
              onClick={() => !isBusy && inputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl transition-all
                ${isBusy ? 'cursor-default opacity-80 border-gray-200' : 'hover:border-primary-500 hover:bg-primary-500/5 border-gray-300 cursor-pointer'}`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/avi,video/webm,.mp4,.mov,.avi,.webm"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
              />

              {isCompressing ? (
                <div className="p-8 space-y-3 text-center">
                  <div className="text-3xl"><i className="ti ti-player-skip-forward animate-pulse text-primary-500" /></div>
                  <p className="font-semibold text-gray-700">Inapunguza ukubwa wa video…</p>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-purple-500 h-3 rounded-full transition-all duration-300" style={{ width: `${compressProgress}%` }} />
                  </div>
                  <p className="text-sm text-gray-500">{compressProgress}% — video itachukua muda kidogo</p>
                </div>
              ) : isUploading ? (
                <div className="p-8 space-y-3 text-center">
                  <div className="text-3xl"><i className="ti ti-loader-2 animate-spin text-primary-500" /></div>
                  <p className="font-semibold text-gray-700">Inapakia kwenye Cloudinary…</p>
                  {compressInfo && (
                    <p className="text-xs text-green-600">
                      Imepunguzwa: {compressInfo.originalMB.toFixed(1)} MB → {compressInfo.compressedMB.toFixed(1)} MB
                    </p>
                  )}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-primary-500 h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-sm text-gray-500">{uploadProgress}%</p>
                </div>
              ) : file ? (
                <div className="p-8 space-y-3 text-center">
                  <div className="text-3xl"><i className="ti ti-movie text-primary-500" /></div>
                  <p className="font-semibold text-gray-800 truncate px-4">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatBytes(file.size)}{duration !== null && ` • ${duration}s`}
                    {hasAudio === false && <span className="ml-2 text-amber-600">⚠ Hakuna sauti</span>}
                    {hasAudio === true  && <span className="ml-2 text-green-600">🔊 Ina sauti</span>}
                  </p>
                  {file.size > COMPRESS_THRESHOLD && canCompress() && (
                    <p className="text-xs text-purple-600 flex items-center justify-center gap-1">
                      <i className="ti ti-bolt" /> Video itapunguzwa kabla ya kupakia
                    </p>
                  )}
                  <p className="text-xs text-primary-500">Click kubadilisha faili</p>
                </div>
              ) : (
                <div className="p-8 space-y-3 text-center">
                  <div className="text-5xl"><i className="ti ti-video text-gray-300" /></div>
                  <p className="font-semibold text-gray-700 text-lg">Pakia Video Yako</p>
                  <p className="text-sm text-gray-400">Buruta video hapa au click kupakia</p>
                  <p className="text-xs text-gray-400">
                    Aina: {ALLOWED_EXT_MSG} • Max: 500MB<br />
                    Bora: &lt;100MB, 720p-1080p, 9:16 (vertical)
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
                    {canCompress() && (
                      <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200">
                        <i className="ti ti-bolt mr-0.5" /> Compression ya otomatiki &gt;30MB
                      </span>
                    )}
                    <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                      <i className="ti ti-volume mr-0.5" /> Sauti inahifadhiwa
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Video preview after upload — streaming ready ── */
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <VideoPlayer src={videoUrl ?? preview ?? ''} title={title || 'Preview ya Video'} />
              {/* Watermark preview overlay */}
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 pointer-events-none select-none z-20">
                <div className="bg-black/70 rounded-xl px-3 py-1.5 flex flex-col items-center">
                  <span className="text-white/80 text-[9px] font-semibold tracking-wide leading-none">NyumbaFasta</span>
                  <span className="text-white text-xs font-bold leading-tight">nyumbafasta.co</span>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/80 z-20"
              >
                <i className="ti ti-x" /> Video Mpya
              </button>
            </div>
          )}

          {/* Audio warning if no sound detected */}
          {hasAudio === false && state === 'selected' && (
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <i className="ti ti-volume-off flex-shrink-0 mt-0.5" />
              <span>Video hii inaonekana haina sauti. Instagram na TikTok zinashauriwa ziwe na sauti.</span>
            </div>
          )}

          {/* Warnings */}
          {warnings.map((w, i) => (
            <div key={i} className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
              <i className="ti ti-alert-triangle flex-shrink-0 mt-0.5" /><span>{w}</span>
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <i className="ti ti-circle-x flex-shrink-0 mt-0.5" /><span>{error}</span>
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
                disabled={isBusy}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Maelezo (hiari)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Maelezo mafupi ya video"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isBusy}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Aina ya Video</label>
              <div className="grid grid-cols-2 gap-2">
                {VIDEO_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setVideoType(t.value)}
                    disabled={isBusy}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                      videoType === t.value
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <i className={`ti ti-${t.icon} text-sm`} /><span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {state === 'selected' && (
            <button
              onClick={handleUpload}
              disabled={!file || !title.trim()}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2"
            >
              {file && file.size > COMPRESS_THRESHOLD && canCompress()
                ? <><i className="ti ti-bolt" /> Compress &amp; Pakia Video</>
                : <><i className="ti ti-upload" /> Pakia Video</>}
            </button>
          )}

          {(state === 'posted' || state === 'error') && (
            <button onClick={handleReset} className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50">
              + Pakia Video Mpya
            </button>
          )}
        </div>

        {/* ── RIGHT: Captions + Publish ── */}
        <div className="space-y-4">

          {/* Captions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Captions</p>
              <button
                onClick={handleGenerateCaption}
                disabled={!title.trim() || state === 'generating' || isBusy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
              >
                {state === 'generating'
                  ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Amina anaandika...</>
                  : <><i className="ti ti-sparkles" /> Tengeneza kwa AI</>}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                  <PlatformLogo platform="instagram" size={14} /> Instagram
                </label>
                <span className={`text-xs font-medium ${captionIg.length > 2090 ? 'text-red-500' : captionIg.length > 1760 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {captionIg.length}/2200
                </span>
              </div>
              <textarea
                value={captionIg}
                onChange={(e) => setCaptionIg(e.target.value.slice(0, 2200))}
                rows={5}
                disabled={isBusy}
                placeholder="Caption + hashtags za Instagram Reels..."
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
                  captionIg.length > 2090 ? 'border-red-400' : captionIg.length > 1760 ? 'border-amber-400' : 'border-gray-200'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                  <PlatformLogo platform="facebook" size={14} /> Facebook
                </label>
                <span className={`text-xs font-medium ${captionFb.length > 4750 ? 'text-red-500' : captionFb.length > 4000 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {captionFb.length}/5000
                </span>
              </div>
              <textarea
                value={captionFb}
                onChange={(e) => setCaptionFb(e.target.value.slice(0, 5000))}
                rows={4}
                disabled={isBusy}
                placeholder="Caption ya Facebook Video..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Wakati wa Kuchapisha</p>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={!scheduleMode} onChange={() => setScheduleMode(false)} className="accent-primary-500" disabled={isBusy} />
                <span className="text-sm text-gray-700">Sasa Hivi</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" checked={scheduleMode} onChange={() => setScheduleMode(true)} className="accent-primary-500" disabled={isBusy} />
                <span className="text-sm text-gray-700">Panga Ratiba</span>
              </label>
            </div>
            {scheduleMode && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={isBusy}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            )}
          </div>

          {/* ── 3 Publish buttons ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Chapisha Kwenye</p>

            {!hasVideo && (
              <p className="text-xs text-gray-400 text-center py-2">Pakia video kwanza ili uweze kuchapisha</p>
            )}

            {/* IG only */}
            <button
              onClick={() => handlePublish(['instagram'])}
              disabled={!hasVideo || !captionIg.trim() || isBusy}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95
                         bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {publishingFor?.join(',') === 'instagram'
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Instagram inachapisha (dakika 1–3)...</>
                : <><PlatformLogo platform="instagram" size={16} /> Instagram Reels
                    {platformStatus.instagram === 'done' && <i className="ti ti-check ml-1" />}
                  </>}
            </button>

            {/* FB only */}
            <button
              onClick={() => handlePublish(['facebook'])}
              disabled={!hasVideo || !captionFb.trim() || isBusy}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95
                         bg-[#1877F2] text-white
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {publishingFor?.join(',') === 'facebook'
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Facebook inachapisha...</>
                : <><PlatformLogo platform="facebook" size={16} /> Facebook Video
                    {platformStatus.facebook === 'done' && <i className="ti ti-check ml-1" />}
                  </>}
            </button>

            {/* Both */}
            <button
              onClick={() => handlePublish(['instagram', 'facebook'])}
              disabled={!hasVideo || !captionIg.trim() || !captionFb.trim() || isBusy}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95
                         bg-primary-500 hover:bg-primary-600 text-white
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {publishingFor?.length === 2
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Inachapisha IG + FB (dakika 1–3)...</>
                : <><i className="ti ti-rocket" /> Chapisha Zote (IG + FB)</>}
            </button>

            {/* Hints */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {!captionIg.trim() && hasVideo && (
                <p className="text-[10px] text-amber-600">↑ Andika caption ya IG</p>
              )}
              {!captionFb.trim() && hasVideo && (
                <p className="text-[10px] text-amber-600 text-right">↑ Andika caption ya FB</p>
              )}
            </div>
          </div>

          {/* Success state */}
          {state === 'posted' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                <i className="ti ti-check" /> Video imechapishwa!
              </p>
              {platformStatus.instagram === 'done' && (
                <p className="text-xs text-green-700 flex items-center gap-1"><PlatformLogo platform="instagram" size={13} /> Instagram Reel: imefanikiwa</p>
              )}
              {platformStatus.instagram === 'error' && (
                <p className="text-xs text-red-600 flex items-center gap-1"><PlatformLogo platform="instagram" size={13} /> Instagram: imeshindwa</p>
              )}
              {platformStatus.facebook === 'done' && (
                <p className="text-xs text-green-700 flex items-center gap-1"><PlatformLogo platform="facebook" size={13} /> Facebook Video: imefanikiwa</p>
              )}
              {platformStatus.facebook === 'error' && (
                <p className="text-xs text-red-600 flex items-center gap-1"><PlatformLogo platform="facebook" size={13} /> Facebook: imeshindwa</p>
              )}
              {warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700">{w}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Video History ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <i className="ti ti-list" /> Video Zilizopita
          </h3>
          <button
            onClick={loadHistory}
            disabled={histLoading}
            className="text-xs text-primary-500 hover:underline disabled:opacity-50"
          >
            {histLoading ? 'Inapakia...' : <><i className="ti ti-refresh" /> Refresh</>}
          </button>
        </div>

        {histLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-3xl mb-2"><i className="ti ti-video text-gray-300" /></div>
            <p className="text-sm">Hakuna video zilizopakiwa bado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((v) => {
              const vt = VIDEO_TYPES.find(t => t.value === v.video_type)
              return (
                <div key={v.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <i className={`ti ti-${vt?.icon ?? 'video'} text-2xl text-gray-400 flex-shrink-0`} />
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
                      <p className="text-xs text-red-500 mt-0.5 truncate" title={v.error_message}>{v.error_message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {v.video_url && (
                      <button
                        onClick={async () => {
                          if (downloading === v.id) return
                          setDownloading(v.id)
                          try {
                            const filename = `nyumbafasta_${v.video_type}_${v.id.slice(0, 8)}.mp4`
                            await downloadVideo(v.video_url!, filename)
                            showToast('Video inashuka...')
                          } finally {
                            setDownloading(null)
                          }
                        }}
                        disabled={downloading === v.id}
                        title="Pakua video"
                        className="text-xs px-2 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1 disabled:opacity-60 transition-all"
                      >
                        {downloading === v.id
                          ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" />
                          : <i className="ti ti-download" aria-hidden="true" />
                        }
                        <span className="hidden sm:inline">{downloading === v.id ? '...' : 'Pakua'}</span>
                      </button>
                    )}
                    {v.post_status === 'draft' && (
                      <button
                        onClick={() => {
                          setVideoId(v.id)
                          setVideoUrl(null)
                          setState('uploaded')
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="text-xs px-2 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                      >
                        Chapisha
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
