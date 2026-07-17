'use client'
import Image from 'next/image'
import { useState, useRef, useCallback } from 'react'

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

export default function UploadCreative({ campaignId, onDone, onSkip }: Props) {
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

  const handleFiles = useCallback((selected: FileList | null) => {
    if (!selected || selected.length === 0) return
    const arr = Array.from(selected)
    setFiles(arr)
    setWarning(null)
    setError(null)
    setCreative(null)
    setPhase('idle')

    // Preview: first file
    const url = URL.createObjectURL(arr[0])
    setPreview(url)
  }, [])

  // ── Upload ────────────────────────────────────────────────────────────────

  async function upload(force = false) {
    if (files.length === 0) return
    setPhase('uploading')
    setError(null)
    setWarning(null)
    setProgress(10)

    const form = new FormData()
    if (force) form.append('force', 'true')

    if (files.length === 1) {
      form.append('file', files[0])
    } else {
      for (const f of files) form.append('files', f)
    }

    setProgress(30)

    try {
      const res  = await fetch(`/api/v1/advertising/campaigns/${campaignId}/creative`, {
        method: 'POST',
        body:   form,
      })
      const data = await res.json()
      setProgress(90)

      if (res.status === 422 && data.warning) {
        setWarning(data.message)
        setPhase('idle')
        setProgress(0)
        return
      }

      if (!res.ok) {
        setError(data.error ?? 'Kuna tatizo. Jaribu tena.')
        setPhase('failed')
        return
      }

      setCreative(data.creative)
      setPhase('done')
      setProgress(100)
      onDone?.(data.creative)
    } catch {
      setError('Haikuweza kuunganika. Angalia mtandao na ujaribu tena.')
      setPhase('failed')
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
            <p className="font-bold text-sm">Creative imepakiwa!</p>
            <p className="text-xs text-green-600">Mifumo yote ya matangazo imeundwa kiotomatiki.</p>
          </div>
        </div>

        {/* Variant previews */}
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Mifumo iliyoundwa
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
                ? `${files.length} picha zilizochaguliwa`
                : files[0].name}
              {' '}<button
                onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
                className="text-primary-600 underline"
              >
                Badilisha
              </button>
            </p>
          </div>
        ) : (
          <>
            <p className="text-3xl mb-2">🖼️</p>
            <p className="text-sm font-medium text-gray-700">Buruta hapa au bonyeza kuchagua</p>
            <p className="text-xs text-gray-400 mt-1">
              Picha moja, video moja, au picha nyingi (carousel)
            </p>
            <p className="text-xs text-gray-400">Picha hadi 10MB · Video hadi 100MB</p>
          </>
        )}
      </div>

      {/* Portrait warning */}
      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <p className="font-bold text-amber-800 mb-1">⚠️ Picha ndefu sana</p>
          <p className="text-amber-700 text-xs">{warning}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => upload(true)}
              className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-600 transition"
            >
              Endelea hata hivyo
            </button>
            <button
              onClick={() => { setFiles([]); setPreview(null); setWarning(null) }}
              className="text-xs border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
            >
              Chagua picha nyingine
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
            <span>Inashughulikia creative...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Mifumo ya banner, nearby, na featured inaundwa kiotomatiki...
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
            Pakia Creative
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="border border-gray-200 text-gray-500 text-sm px-4 py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              Ruka
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Landscape (upana zaidi) inafanya kazi vizuri zaidi · WebP · nyumbafasta.co watermark
      </p>
    </div>
  )
}
