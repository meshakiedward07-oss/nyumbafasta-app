'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── Preset tracks from Supabase Storage bucket "music" ───────────────────────
// Upload MP3 files there to enable them: upbeat.mp3, chill.mp3, bongo.mp3, corporate.mp3
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const presetUrl = (name: string) => `${SUPA_URL}/storage/v1/object/public/music/${name}.mp3`

const PRESET_TRACKS = [
  { id: 'upbeat',    label: 'Upbeat / Furaha', url: presetUrl('upbeat'),    emoji: '🎵' },
  { id: 'chill',     label: 'Chill / Utulivu', url: presetUrl('chill'),     emoji: '🎶' },
  { id: 'bongo',     label: 'Bongo Flava',      url: presetUrl('bongo'),     emoji: '🥁' },
  { id: 'corporate', label: 'Professional',     url: presetUrl('corporate'), emoji: '🎼' },
]

type MediaType = 'image' | 'video'
type Platform  = 'instagram' | 'facebook' | 'both'
type MusicSrc  = 'none' | 'device' | string  // 'device' = local file, string = preset id

interface SocialListing {
  id: string; title: string; images: string[]; video_url: string | null
  district: string; region: string; price_monthly: number; type: string
}
interface Props {
  listing: SocialListing; defaultPlatform?: string
  onClose: () => void; onPosted: () => void; showToast: (msg: string) => void
}

function addCloudinaryTransforms(url: string, br: number, co: number, sa: number): string {
  const t: string[] = []
  if (br !== 0) t.push(`e_brightness:${br}`)
  if (co !== 0) t.push(`e_contrast:${co}`)
  if (sa !== 0) t.push(`e_saturation:${sa}`)
  if (!t.length) return url
  const i = url.indexOf('/upload/')
  return i === -1 ? url : `${url.slice(0, i + 8)}${t.join(',')}/${url.slice(i + 8)}`
}

// Canvas-based mixing — avoids cross-origin captureStream() restriction
async function mixVideoAudio(
  videoEl: HTMLVideoElement,
  musicSource: string | ArrayBuffer,   // URL or ArrayBuffer from device file
  musicVol: number,
  videoVol: number,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  const duration = videoEl.duration || 30

  // Canvas to capture video frames (same-origin regardless of video source)
  const canvas    = document.createElement('canvas')
  canvas.width    = videoEl.videoWidth  || 640
  canvas.height   = videoEl.videoHeight || 360
  const ctx2d     = canvas.getContext('2d')!

  const audioCtx  = new AudioContext()

  // Video audio
  const videoSrc  = audioCtx.createMediaElementSource(videoEl)
  const videoGain = audioCtx.createGain()
  videoGain.gain.value = videoVol / 100
  videoSrc.connect(videoGain)

  // Background music
  const rawBuf    = typeof musicSource === 'string'
    ? await (await fetch(musicSource)).arrayBuffer()
    : musicSource
  const musicBuf  = await audioCtx.decodeAudioData(rawBuf)
  const musicNode = audioCtx.createBufferSource()
  musicNode.buffer = musicBuf
  musicNode.loop   = true
  const musicGain  = audioCtx.createGain()
  musicGain.gain.value = musicVol / 100
  musicNode.connect(musicGain)

  // Mix both to a stream destination
  const audioDest = audioCtx.createMediaStreamDestination()
  videoGain.connect(audioDest)
  musicGain.connect(audioDest)

  // Canvas stream + mixed audio stream
  const canvasStream = canvas.captureStream(30)
  const combined     = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ])

  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
    ? 'video/webm;codecs=vp8,opus'
    : 'video/webm'
  const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 2_500_000 })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const ticker = setInterval(() => {
      onProgress(Math.min(94, ((Date.now() - startedAt) / 1000 / duration) * 100))
    }, 400)

    let rafId = 0
    const drawFrame = () => {
      ctx2d.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      rafId = requestAnimationFrame(drawFrame)
    }

    const cleanup = () => { clearInterval(ticker); cancelAnimationFrame(rafId); audioCtx.close() }

    recorder.onstop  = () => { cleanup(); onProgress(100); resolve(new Blob(chunks, { type: 'video/webm' })) }
    recorder.onerror = (e) => { cleanup(); reject(e) }

    videoEl.currentTime = 0
    void videoEl.play().then(() => {
      recorder.start(100)
      musicNode.start()
      drawFrame()
    }).catch(reject)

    videoEl.onended = () => { if (recorder.state === 'recording') recorder.stop() }
    setTimeout(() => { if (recorder.state === 'recording') recorder.stop() }, (duration + 10) * 1000)
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

  // Music state
  const [musicSrc,       setMusicSrc]       = useState<MusicSrc>('none')
  const [musicVol,       setMusicVol]       = useState(60)
  const [videoVol,       setVideoVol]       = useState(40)
  const [deviceFile,     setDeviceFile]     = useState<File | null>(null)
  const [deviceObjUrl,   setDeviceObjUrl]   = useState<string | null>(null)
  const [previewingId,   setPreviewingId]   = useState<string | null>(null)  // track being previewed

  // Caption + platforms
  const [caption,        setCaption]        = useState('')
  const [captionLoading, setCaptionLoading] = useState(false)
  const [platforms,      setPlatforms]      = useState<Set<Platform>>(() => {
    const s = new Set<Platform>()
    if (!defaultPlatform || ['all','both','instagram'].includes(defaultPlatform)) s.add('instagram')
    if (!defaultPlatform || ['all','both','facebook'].includes(defaultPlatform))  s.add('facebook')
    return s
  })

  // Progress
  const [posting,     setPosting]     = useState(false)
  const [mixProgress, setMixProgress] = useState(0)
  const [mixStep,     setMixStep]     = useState('')

  const videoRef     = useRef<HTMLVideoElement>(null)
  const audioRef     = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objUrlRef    = useRef<string | null>(null)

  useEffect(() => { void loadCaption() }, [listing.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup device object URL on unmount
  useEffect(() => () => { if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current) }, [])

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
    setPlatforms(prev => {
      const n = new Set(prev)
      if (n.has(p)) { n.delete(p) } else { n.add(p) }
      return n
    })
  }

  function buildPreviewImage(): string {
    const raw = images[selImage] ?? images[0] ?? ''
    return raw ? addCloudinaryTransforms(raw, brightness, contrast, saturation) : ''
  }

  // Handle device music file pick
  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current)
    const url = URL.createObjectURL(file)
    objUrlRef.current = url
    setDeviceFile(file)
    setDeviceObjUrl(url)
    setMusicSrc('device')
    setPreviewingId(null)
  }

  // Preview a track (preset or device)
  function togglePreview(id: string, url: string | null) {
    if (previewingId === id) {
      setPreviewingId(null)
      audioRef.current?.pause()
    } else {
      setPreviewingId(id)
      if (audioRef.current && url) {
        audioRef.current.src = url
        void audioRef.current.play().catch(() => {
          setPreviewingId(null)
          showToast('Haiwezi kucheza — angalia faili la muziki')
        })
      }
    }
  }

  // Resolve the audio source for mixing
  function getMusicSource(): string | ArrayBuffer | null {
    if (musicSrc === 'none') return null
    if (musicSrc === 'device') return deviceObjUrl
    return PRESET_TRACKS.find(t => t.id === musicSrc)?.url ?? null
  }

  const handlePost = useCallback(async () => {
    if (!platforms.size) { showToast('Chagua platform moja angalau'); return }
    setPosting(true); setMixProgress(0); setMixStep('')

    try {
      let videoOverride: string | undefined

      const audioSrc = getMusicSource()
      if (mediaType === 'video' && audioSrc && videoRef.current) {
        setMixStep('Inachanganya muziki…')

        // Check if browser supports MediaRecorder
        if (typeof MediaRecorder === 'undefined') {
          showToast('Browser haisaidii kurekodi — inaendelea bila muziki')
        } else {
          try {
            const blob = await mixVideoAudio(
              videoRef.current,
              audioSrc,
              musicVol,
              videoVol,
              setMixProgress,
            )

            setMixStep('Inapakia video…')
            setMixProgress(97)

            const fname = `mixed/${listing.id}_${Date.now()}.webm`
            const { createClient } = await import('@/lib/supabase/client')
            const supabaseBrowser  = createClient()
            const { error: upErr } = await supabaseBrowser.storage
              .from('listing-images')
              .upload(fname, blob, { contentType: 'video/webm', upsert: true })

            if (!upErr) {
              const { data: { publicUrl } } = supabaseBrowser.storage
                .from('listing-images').getPublicUrl(fname)
              videoOverride = publicUrl
            } else {
              console.error('[PostEditor] upload failed:', upErr)
              showToast('Imeshindwa kupakia — inaendelea bila muziki')
            }
          } catch (err) {
            console.error('[PostEditor] mix error:', err)
            const msg = err instanceof Error ? err.message : String(err)
            showToast(`Mixing imeshindwa: ${msg.slice(0, 80)} — inaendelea bila muziki`)
          }
        }
      }

      setMixStep('Inachapisha…'); setMixProgress(99)

      const imageOverride = mediaType === 'image' ? buildPreviewImage() : undefined
      const platform: Platform = platforms.has('instagram') && platforms.has('facebook')
        ? 'both' : platforms.has('instagram') ? 'instagram' : 'facebook'

      const res  = await fetch('/api/v1/social/post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id, platform,
          imageOverride, videoOverride,
          captionOverride: caption || undefined,
        }),
      })
      const body = await res.text()
      let data: { ok?: boolean; status?: string; error?: string } = {}
      try { data = JSON.parse(body) } catch {
        showToast(`Hitilafu (${res.status}): ${body.slice(0, 100)}`); return
      }
      if (data.error)                  { showToast(`Hitilafu: ${data.error}`); return }
      if (data.status === 'published') { showToast('Imechapishwa!'); onPosted(); onClose() }
      else                             { showToast('Imeshindwa kuchapisha') }
    } finally {
      setPosting(false); setMixProgress(0); setMixStep('')
    }
  }, [platforms, mediaType, musicSrc, musicVol, videoVol, caption, listing.id, buildPreviewImage, showToast, onPosted, onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
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

        {/* ── Media type tabs ──────────────────────────────────────────────── */}
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

        {/* ── Image editor ─────────────────────────────────────────────────── */}
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
                  <button key={i} onClick={() => setSelImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${selImage === i ? 'border-primary-500' : 'border-transparent opacity-60'}`}
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
                  <input type="range" min={-60} max={60} value={val}
                    onChange={e => (set as (n: number) => void)(Number(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none accent-primary-500 bg-gray-200"
                  />
                </div>
              ))}
              <button onClick={() => { setBrightness(0); setContrast(0); setSaturation(0) }}
                className="text-xs text-primary-500 font-medium mt-1">
                Rejesha asili
              </button>
            </div>
          </div>
        )}

        {/* ── Video editor ─────────────────────────────────────────────────── */}
        {mediaType === 'video' && listing.video_url && (
          <div className="px-4 space-y-4">
            {/* Video preview */}
            <div className="rounded-2xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                src={listing.video_url}
                controls
                playsInline
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            </div>

            {/* ── Music section ─────────────────────────────────────────────── */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <i className="ti ti-music text-primary-500" aria-hidden="true" /> Muziki wa nyuma
              </p>

              {/* Device file picker — primary option */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  musicSrc === 'device'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-dashed border-gray-300 hover:border-primary-300 bg-white'
                }`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${musicSrc === 'device' ? 'bg-primary-100' : 'bg-gray-100'}`}>
                  <i className={`ti ti-device-mobile text-base ${musicSrc === 'device' ? 'text-primary-500' : 'text-gray-500'}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${musicSrc === 'device' ? 'text-primary-700' : 'text-gray-700'}`}>
                    {deviceFile ? deviceFile.name : 'Chagua kutoka simu yangu'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {deviceFile ? `${(deviceFile.size / 1_048_576).toFixed(1)} MB · MP3, M4A, WAV` : 'Gusa kupachika faili la muziki'}
                  </p>
                </div>
                {deviceFile && (
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePreview('device', deviceObjUrl) }}
                    className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-primary-500 flex-shrink-0"
                  >
                    <i className={`ti ${previewingId === 'device' ? 'ti-player-stop' : 'ti-player-play'} text-sm`} aria-hidden="true" />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFilePick} />

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">au chagua maktaba</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Preset tracks */}
              <div className="space-y-1">
                {/* None option */}
                <label className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all ${musicSrc === 'none' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}>
                  <input type="radio" name="music" value="none" checked={musicSrc === 'none'}
                    onChange={() => { setMusicSrc('none'); setPreviewingId(null); audioRef.current?.pause() }}
                    className="accent-primary-500 w-4 h-4" />
                  <span className="text-sm text-gray-600">🔇 Hakuna muziki</span>
                </label>

                {PRESET_TRACKS.map(track => (
                  <div key={track.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${musicSrc === track.id ? 'bg-primary-50' : 'hover:bg-gray-100'}`}>
                    <input type="radio" name="music" value={track.id} checked={musicSrc === track.id}
                      onChange={() => { setMusicSrc(track.id); setPreviewingId(null); audioRef.current?.pause() }}
                      className="accent-primary-500 w-4 h-4" />
                    <span className="text-sm text-gray-700 flex-1">{track.emoji} {track.label}</span>
                    <button
                      type="button"
                      onClick={() => togglePreview(track.id, track.url)}
                      className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:text-primary-500 transition-colors"
                    >
                      <i className={`ti ${previewingId === track.id ? 'ti-player-stop' : 'ti-player-play'} text-sm`} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Hidden audio element for previewing */}
              <audio ref={audioRef} loop onEnded={() => setPreviewingId(null)}
                onError={() => { setPreviewingId(null); showToast('Haiwezi kucheza faili hili') }} />

              {/* Volume sliders — show only if music is selected */}
              {musicSrc !== 'none' && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  {[
                    { label: 'Sauti ya muziki', val: musicVol, set: setMusicVol, icon: 'ti-music' },
                    { label: 'Sauti ya video',  val: videoVol, set: setVideoVol, icon: 'ti-video' },
                  ].map(({ label, val, set, icon }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                          <i className={`ti ${icon} text-sm`} aria-hidden="true" /> {label}
                        </span>
                        <span className="text-xs text-gray-400">{val}%</span>
                      </div>
                      <input type="range" min={0} max={100} value={val}
                        onChange={e => (set as (n: number) => void)(Number(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none accent-primary-500 bg-gray-200"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-2.5 py-2 leading-relaxed">
                    <i className="ti ti-clock text-xs" aria-hidden="true" /> Kuchanganya kunahitaji muda sawa na urefu wa video (kwa mfano video ya sekunde 30 = sekunde 30 za processing)
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Caption editor ───────────────────────────────────────────────── */}
        <div className="px-4 mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Maandishi ya post</p>
            <button onClick={loadCaption} disabled={captionLoading}
              className="flex items-center gap-1 text-xs text-primary-500 font-medium disabled:opacity-50">
              <i className={`ti ti-refresh text-sm ${captionLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {captionLoading ? 'Inaandika...' : 'Tengeneza upya'}
            </button>
          </div>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={6}
            placeholder="Maandishi ya post yataonekana hapa…"
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <p className="text-xs text-gray-400 text-right">{caption.length} herufi</p>
        </div>

        {/* ── Platform selector ────────────────────────────────────────────── */}
        <div className="px-4 mt-2 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">Chapisha kwenye</p>
          <div className="flex gap-4">
            {(['instagram', 'facebook'] as Platform[]).map(p => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={platforms.has(p)} onChange={() => togglePlatform(p)}
                  className="w-4 h-4 rounded accent-primary-500" />
                <span className="text-sm text-gray-700">{p === 'instagram' ? 'Instagram' : 'Facebook'}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mix progress overlay ─────────────────────────────────────────────── */}
      {posting && (mixProgress > 0 || mixStep) && (
        <div className="absolute bottom-20 left-4 right-4 bg-white border border-gray-100 rounded-xl p-3 shadow-lg">
          <p className="text-xs text-gray-600 mb-1.5 flex items-center gap-1.5">
            <i className="ti ti-loader-2 animate-spin text-primary-500 text-sm" aria-hidden="true" />
            {mixStep || 'Inachapisha…'} {mixProgress > 0 && mixProgress < 99 ? `${Math.round(mixProgress)}%` : ''}
          </p>
          {mixProgress > 0 && (
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${mixProgress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-3">
        <button onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Ghairi
        </button>
        <button onClick={handlePost} disabled={posting || !platforms.size || !caption}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 transition-all">
          {posting
            ? <><i className="ti ti-loader-2 animate-spin text-sm" /> {mixStep || 'Inachapisha…'}</>
            : <><i className="ti ti-send text-sm" /> Chapisha</>}
        </button>
      </div>
    </div>
  )
}
