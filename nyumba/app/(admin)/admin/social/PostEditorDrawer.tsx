'use client'
import { useState, useRef, useEffect } from 'react'

// ── Music tracks — upload MP3s to Supabase Storage bucket "music" ──────────
// Names: upbeat.mp3 · chill.mp3 · bongo.mp3 · corporate.mp3
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const musicUrl = (name: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/music/${name}.mp3`

const MUSIC_TRACKS = [
  { id: 'none',      label: 'Hakuna muziki',  url: null,                   emoji: '🔇' },
  { id: 'upbeat',    label: 'Upbeat / Furaha', url: musicUrl('upbeat'),    emoji: '🎵' },
  { id: 'chill',     label: 'Chill / Utulivu', url: musicUrl('chill'),     emoji: '🎶' },
  { id: 'bongo',     label: 'Bongo Flava',      url: musicUrl('bongo'),     emoji: '🥁' },
  { id: 'corporate', label: 'Professional',     url: musicUrl('corporate'), emoji: '🎼' },
]

type MediaType = 'image' | 'video'
type Platform  = 'instagram' | 'facebook' | 'both'

interface SocialListing {
  id: string
  title: string
  images: string[]
  video_url: string | null
  district: string
  region: string
  price_monthly: number
  type: string
}

interface Props {
  listing: SocialListing
  defaultPlatform?: string
  onClose: () => void
  onPosted: () => void
  showToast: (msg: string) => void
}

function addCloudinaryTransforms(url: string, brightness: number, contrast: number, saturation: number): string {
  const transforms: string[] = []
  if (brightness !== 0) transforms.push(`e_brightness:${brightness}`)
  if (contrast   !== 0) transforms.push(`e_contrast:${contrast}`)
  if (saturation !== 0) transforms.push(`e_saturation:${saturation}`)
  if (!transforms.length) return url
  const idx = url.indexOf('/upload/')
  if (idx === -1) return url
  return `${url.slice(0, idx + 8)}${transforms.join(',')}/${url.slice(idx + 8)}`
}

async function mixVideoWithMusic(
  videoEl: HTMLVideoElement,
  trackUrl: string,
  volume: number,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const ctx      = new AudioContext()
  const duration = videoEl.duration || 30

  const videoSrc  = ctx.createMediaElementSource(videoEl)
  const videoGain = ctx.createGain()
  videoGain.gain.value = 0.4
  videoSrc.connect(videoGain)

  const musicBuf  = await ctx.decodeAudioData(await (await fetch(trackUrl)).arrayBuffer())
  const musicSrc  = ctx.createBufferSource()
  musicSrc.buffer = musicBuf
  musicSrc.loop   = true
  const musicGain = ctx.createGain()
  musicGain.gain.value = volume / 100
  musicSrc.connect(musicGain)

  const dest = ctx.createMediaStreamDestination()
  videoGain.connect(dest)
  musicGain.connect(dest)

  const videoStream = (videoEl as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
  if (!videoStream) { ctx.close(); throw new Error('Browser haisaidii kurekodi video') }

  const combined = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ])

  const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'
  const recorder = new MediaRecorder(combined, { mimeType })
  const chunks: BlobPart[] = []

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const ticker = setInterval(() => {
      onProgress(Math.min(95, ((Date.now() - startedAt) / 1000 / duration) * 100))
    }, 500)

    recorder.onstop = () => { clearInterval(ticker); onProgress(100); ctx.close(); resolve(new Blob(chunks, { type: mimeType })) }
    recorder.onerror = (e) => { clearInterval(ticker); ctx.close(); reject(e) }

    recorder.start()
    musicSrc.start()
    videoEl.play()
    videoEl.onended = () => { if (recorder.state === 'recording') recorder.stop() }
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, (duration + 5) * 1000)
  })
}

export default function PostEditorDrawer({ listing, defaultPlatform, onClose, onPosted, showToast }: Props) {
  const images   = listing.images ?? []
  const hasVideo = !!listing.video_url

  const [mediaType,      setMediaType]      = useState<MediaType>(hasVideo ? 'video' : 'image')
  const [selImage,       setSelImage]       = useState(0)
  const [brightness,     setBrightness]     = useState(0)
  const [contrast,       setContrast]       = useState(0)
  const [saturation,     setSaturation]     = useState(0)
  const [musicId,        setMusicId]        = useState('none')
  const [musicVolume,    setMusicVolume]    = useState(60)
  const [previewMusic,   setPreviewMusic]   = useState(false)
  const [caption,        setCaption]        = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [platforms,      setPlatforms]      = useState<Set<Platform>>(() => {
    const s = new Set<Platform>()
    if (!defaultPlatform || ['all','both','instagram'].includes(defaultPlatform)) s.add('instagram')
    if (!defaultPlatform || ['all','both','facebook'].includes(defaultPlatform))  s.add('facebook')
    return s
  })
  const [posting,     setPosting]     = useState(false)
  const [mixProgress, setMixProgress] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => { void loadCaption() }, [listing.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCaption() {
    setCaptionLoading(true)
    try {
      const res  = await fetch('/api/v1/social/caption', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, platform: 'instagram' }),
      })
      const data = await res.json() as { caption?: string; hashtags?: string }
      if (data.caption) setCaption(`${data.caption}\n\n${data.hashtags ?? ''}`.trim())
    } catch { /* silent */ } finally { setCaptionLoading(false) }
  }

  function togglePlatform(p: Platform) {
    setPlatforms(prev => { const n = new Set(prev); if (n.has(p)) { n.delete(p) } else { n.add(p) }; return n })
  }

  function buildPreviewImage(): string {
    const raw = images[selImage] ?? images[0] ?? ''
    return raw ? addCloudinaryTransforms(raw, brightness, contrast, saturation) : ''
  }

  async function handlePost() {
    if (!platforms.size) { showToast('Chagua platform moja angalau'); return }
    setPosting(true); setMixProgress(0)

    try {
      let videoOverride: string | undefined

      const track = MUSIC_TRACKS.find(t => t.id === musicId)
      if (mediaType === 'video' && track?.url && videoRef.current) {
        showToast('Inachanganya muziki… subiri')
        try {
          const blob  = await mixVideoWithMusic(videoRef.current, track.url, musicVolume, setMixProgress)
          const fname = `mixed/${listing.id}_${Date.now()}.webm`
          const { supabaseAdmin } = await import('@/lib/agent/supabaseAdmin')
          const { error: upErr } = await supabaseAdmin.storage
            .from('listing-images').upload(fname, blob, { contentType: blob.type, upsert: true })
          if (!upErr) {
            const { data: { publicUrl } } = supabaseAdmin.storage.from('listing-images').getPublicUrl(fname)
            videoOverride = publicUrl
          }
        } catch (e) {
          console.error('[PostEditor] mix failed:', e)
          showToast('Muziki haukuchanganywa — inaendelea bila muziki')
        }
      }

      const imageOverride = mediaType === 'image' ? buildPreviewImage() : undefined
      const platform: Platform = platforms.has('instagram') && platforms.has('facebook')
        ? 'both' : platforms.has('instagram') ? 'instagram' : 'facebook'

      const res  = await fetch('/api/v1/social/post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, platform, imageOverride, videoOverride, captionOverride: caption || undefined }),
      })
      const body = await res.text()
      let data: { ok?: boolean; status?: string; error?: string } = {}
      try { data = JSON.parse(body) } catch {
        showToast(`Hitilafu (${res.status}): ${body.slice(0, 100)}`); return
      }
      if (data.error)               { showToast(`Hitilafu: ${data.error}`); return }
      if (data.status === 'published') { showToast('Imechapishwa!'); onPosted(); onClose() }
      else                             { showToast('Imeshindwa kuchapisha') }
    } finally { setPosting(false); setMixProgress(0) }
  }

  const selectedTrack = MUSIC_TRACKS.find(t => t.id === musicId)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
        <div>
          <p className="font-semibold text-sm text-gray-800 leading-tight">{listing.title}</p>
          <p className="text-xs text-gray-400">{listing.district}, {listing.region}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
          <i className="ti ti-x text-lg text-gray-500" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">

        {/* ── Media type tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-2 px-4 pt-4 pb-2">
          <button
            onClick={() => setMediaType('image')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${mediaType === 'image' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            <i className="ti ti-photo" aria-hidden="true" /> Picha
          </button>
          {hasVideo && (
            <button
              onClick={() => setMediaType('video')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${mediaType === 'video' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              <i className="ti ti-video" aria-hidden="true" /> Video
            </button>
          )}
        </div>

        {/* ── Image editor ────────────────────────────────────────────────── */}
        {mediaType === 'image' && (
          <div className="px-4 space-y-4">
            {images[selImage] && (
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100">
                <img
                  src={buildPreviewImage()}
                  alt="preview"
                  className="w-full h-full object-cover"
                  style={{ filter: `brightness(${1 + brightness/100}) contrast(${1 + contrast/100}) saturate(${1 + saturation/100})` }}
                />
              </div>
            )}

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${selImage === i ? 'border-primary-500' : 'border-transparent opacity-70'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3 bg-gray-50 rounded-2xl p-4">
              {([
                { label: 'Mwangaza', icon: 'ti-sun',      val: brightness, set: setBrightness },
                { label: 'Utofauti', icon: 'ti-contrast', val: contrast,   set: setContrast   },
                { label: 'Rangi',    icon: 'ti-droplet',  val: saturation, set: setSaturation },
              ] as const).map(({ label, icon, val, set }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                      <i className={`ti ${icon} text-sm`} aria-hidden="true" /> {label}
                    </span>
                    <span className="text-xs text-gray-400 w-8 text-right">{val > 0 ? `+${val}` : val}</span>
                  </div>
                  <input
                    type="range" min={-60} max={60} value={val}
                    onChange={e => (set as (n: number) => void)(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none accent-primary-500 bg-gray-200"
                  />
                </div>
              ))}
              <button onClick={() => { setBrightness(0); setContrast(0); setSaturation(0) }} className="text-xs text-primary-500 font-medium mt-1">
                Rejesha asili
              </button>
            </div>
          </div>
        )}

        {/* ── Video editor ─────────────────────────────────────────────────── */}
        {mediaType === 'video' && listing.video_url && (
          <div className="px-4 space-y-4">
            <div className="rounded-2xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                src={listing.video_url}
                controls
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <i className="ti ti-music text-primary-500" aria-hidden="true" /> Muziki wa nyuma
              </p>

              {MUSIC_TRACKS.map(track => (
                <label key={track.id} className="flex items-center justify-between cursor-pointer py-1">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio" name="music" value={track.id}
                      checked={musicId === track.id}
                      onChange={() => { setMusicId(track.id); setPreviewMusic(false) }}
                      className="accent-primary-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{track.emoji} {track.label}</span>
                  </div>
                  {track.url && (
                    <button
                      type="button"
                      onClick={() => { setMusicId(track.id); setPreviewMusic(musicId === track.id ? !previewMusic : true) }}
                      className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-primary-500 transition-colors"
                    >
                      <i className={`ti ${previewMusic && musicId === track.id ? 'ti-player-stop' : 'ti-player-play'} text-sm`} aria-hidden="true" />
                    </button>
                  )}
                </label>
              ))}

              <audio
                ref={audioRef}
                src={previewMusic && selectedTrack?.url ? selectedTrack.url : undefined}
                autoPlay={previewMusic}
                loop
                onError={() => { setPreviewMusic(false); showToast('Faili la muziki halipatikani — pakia kwanza Supabase Storage bucket "music"') }}
              />

              {musicId !== 'none' && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                      <i className="ti ti-volume text-sm" aria-hidden="true" /> Sauti ya muziki
                    </span>
                    <span className="text-xs text-gray-400">{musicVolume}%</span>
                  </div>
                  <input
                    type="range" min={10} max={100} value={musicVolume}
                    onChange={e => setMusicVolume(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none accent-primary-500 bg-gray-200"
                  />
                </div>
              )}

              <p className="text-[11px] text-gray-400 leading-relaxed">
                Pakia MP3 kwenye Supabase Storage → bucket &quot;music&quot; na majina: upbeat.mp3, chill.mp3, bongo.mp3, corporate.mp3
              </p>
            </div>
          </div>
        )}

        {/* ── Caption editor ───────────────────────────────────────────────── */}
        <div className="px-4 mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Maandishi ya post</p>
            <button
              onClick={loadCaption}
              disabled={captionLoading}
              className="flex items-center gap-1 text-xs text-primary-500 font-medium disabled:opacity-50"
            >
              <i className={`ti ti-refresh text-sm ${captionLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {captionLoading ? 'Inaandika...' : 'Tengeneza upya'}
            </button>
          </div>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={6}
            placeholder="Maandishi ya post yataonekana hapa…"
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <p className="text-xs text-gray-400 text-right">{caption.length} herufi</p>
        </div>

        {/* ── Platform selector ────────────────────────────────────────────── */}
        <div className="px-4 mt-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">Chapisha kwenye</p>
          <div className="flex gap-4">
            {(['instagram', 'facebook'] as Platform[]).map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={platforms.has(p)} onChange={() => togglePlatform(p)} className="w-4 h-4 rounded accent-primary-500" />
                <span className="text-sm text-gray-700">{p === 'instagram' ? 'Instagram' : 'Facebook'}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Mix progress */}
      {posting && mixProgress > 0 && mixProgress < 100 && (
        <div className="absolute bottom-20 left-4 right-4 bg-white border border-gray-100 rounded-xl p-3 shadow-lg">
          <p className="text-xs text-gray-600 mb-1.5">Inachanganya muziki… {Math.round(mixProgress)}%</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${mixProgress}%` }} />
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Ghairi
        </button>
        <button
          onClick={handlePost}
          disabled={posting || !platforms.size || !caption}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-all"
        >
          {posting
            ? <><i className="ti ti-loader-2 animate-spin text-sm" /> {mixProgress > 0 ? 'Inachanganya...' : 'Inachapisha...'}</>
            : <><i className="ti ti-send text-sm" /> Chapisha</>}
        </button>
      </div>
    </div>
  )
}
