'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressVideo, canCompress, type CompressResult } from '@/lib/video/compress'
import { VideoPlayer } from '@/components/listings/VideoPlayer'

interface Props {
  existingVideoUrl?: string | null
  onUploadComplete: (url: string) => void
  onRemove?: () => void
}

const ALLOWED_TYPES = [
  'video/mp4', 'video/quicktime', 'video/webm',
  'video/x-msvideo', 'video/3gpp', 'video/3gpp2', 'video/x-matroska',
]
const ALLOWED_EXTS  = ['.mp4', '.mov', '.webm', '.avi', '.3gp', '.3g2', '.mkv']

// Thresholds tuned for mobile / slow internet
const MAX_MB          = 200   // Hard limit — above this even upload is too slow on 3G
const COMPRESS_ABOVE_MB = 15  // Start compressing from 15MB — keeps upload fast

type Stage = 'idle' | 'compressing' | 'uploading' | 'done' | 'error'

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`
}

function uploadTimeEstimate(bytes: number): string {
  // Assume ~200 Kbps on a typical Tanzanian 3G connection
  const seconds = bytes / (200 * 1024 / 8)
  if (seconds < 60)  return `~${Math.round(seconds)}s`
  if (seconds < 3600) return `~${Math.round(seconds / 60)}dk`
  return `~${(seconds / 3600).toFixed(1)}saa`
}

export function VideoUpload({ existingVideoUrl, onUploadComplete, onRemove }: Props) {
  const [videoUrl, setVideoUrl]         = useState(existingVideoUrl ?? '')
  const [stage, setStage]               = useState<Stage>(existingVideoUrl ? 'done' : 'idle')
  const [progress, setProgress]         = useState(0)
  const [statusText, setStatusText]     = useState('')
  const [error, setError]               = useState('')
  const [compressInfo, setCompressInfo] = useState<{ from: string; to: string } | null>(null)
  const [isMobile, setIsMobile]         = useState(false)
  const [fileSize, setFileSize]         = useState(0)

  const inputRef       = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setIsMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setCompressInfo(null)
    setFileSize(file.size)

    // Validate type
    const validType = ALLOWED_TYPES.includes(file.type)
    const validExt  = ALLOWED_EXTS.some(e => file.name.toLowerCase().endsWith(e))
    if (!validType && !validExt) {
      setError('Aina haifai. Tumia MP4, MOV, au 3GP')
      setStage('error')
      return
    }

    if (file.size > MAX_MB * 1024 * 1024) {
      setError(
        `Video ni kubwa mno (${formatMB(file.size)}). ` +
        `Rekoodi video fupi zaidi au punguza ubora wa kamera. Max ${MAX_MB}MB.`
      )
      setStage('error')
      return
    }

    const needsCompression = file.size > COMPRESS_ABOVE_MB * 1024 * 1024
    let fileToUpload = file

    // ── Compression ─────────────────────────────────────────────────────────
    if (needsCompression) {
      if (!canCompress()) {
        // Browser (likely iOS) can't compress — upload original if under 80MB,
        // otherwise ask user to use a shorter/lower-quality recording
        if (file.size > 80 * 1024 * 1024) {
          setError(
            `Video ni ${formatMB(file.size)} — ni kubwa sana kwa muunganiko wa kawaida. ` +
            `Rekoodi video fupi zaidi (chini ya dakika 1) au punguza ubora wa kamera.`
          )
          setStage('error')
          return
        }
        // Under 80MB on iOS — upload directly without compression
      } else {
        setStage('compressing')
        setProgress(0)
        setStatusText('Inaandaa...')

        const result: CompressResult = await compressVideo(file, (pct) => {
          setProgress(pct)
          setStatusText(
            pct < 15 ? 'Inasoma video...' :
            pct < 90 ? `Inapunguza ukubwa... ${pct}%` :
            'Inakamilisha...'
          )
        })

        fileToUpload = result.file
        if (result.wasCompressed) {
          setCompressInfo({
            from: `${result.originalMB.toFixed(1)}MB`,
            to:   `${result.compressedMB.toFixed(1)}MB`,
          })
        }
      }
    }

    // ── Upload ───────────────────────────────────────────────────────────────
    setStage('uploading')
    setProgress(0)
    setStatusText(`Inaanza kupakia... (${uploadTimeEstimate(fileToUpload.size)})`)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Ingia kwanza kabla ya kupakia video')
        setStage('error')
        return
      }

      const ext  = fileToUpload.name.split('.').pop()?.toLowerCase() || 'mp4'
      const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!

      const publicUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setProgress(pct)
            const remaining = fileToUpload.size - e.loaded
            setStatusText(
              pct < 10 ? `Inaanza kupakia...` :
              pct < 95 ? `Inapakia ${pct}% · ${uploadTimeEstimate(remaining)} iliyobaki` :
              'Inakamilisha...'
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200 || xhr.status === 201) {
            resolve(`${base}/storage/v1/object/public/listing-videos/${path}`)
          } else {
            try {
              const body = JSON.parse(xhr.responseText)
              reject(new Error(body.error || `Imeshindwa (${xhr.status})`))
            } catch {
              reject(new Error(
                xhr.status === 413 ? 'Video ni kubwa mno kwa seva' :
                xhr.status === 0   ? 'Muunganiko ulikatika. Angalia internet yako.' :
                `Imeshindwa (${xhr.status})`
              ))
            }
          }
        })

        xhr.addEventListener('error', () =>
          reject(new Error('Muunganiko ulikatika. Angalia internet yako na ujaribu tena.'))
        )
        xhr.addEventListener('timeout', () =>
          reject(new Error('Muda umekwisha. Video ni kubwa sana kwa muunganiko wako. Jaribu video fupi.'))
        )

        // Timeout: 3× estimated time on 200kbps, minimum 5 minutes
        xhr.timeout = Math.max((fileToUpload.size / (200 * 1024 / 8)) * 3_000, 300_000)

        xhr.open('POST', `${base}/storage/v1/object/listing-videos/${path}`)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('Content-Type', fileToUpload.type || 'video/mp4')
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.setRequestHeader('cache-control', '31536000')
        xhr.send(fileToUpload)
      })

      setVideoUrl(publicUrl)
      setStage('done')
      setProgress(100)
      onUploadComplete(publicUrl)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kupakia video. Jaribu tena.')
      setStage('error')
    }
  }, [onUploadComplete])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function handleRemove() {
    setVideoUrl('')
    setStage('idle')
    setProgress(0)
    setError('')
    setCompressInfo(null)
    setFileSize(0)
    if (inputRef.current)       inputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
    onRemove?.()
  }

  // ── Done: video preview ────────────────────────────────────────────────────
  if (stage === 'done' && videoUrl) {
    return (
      <div className="space-y-2">
        <div className="relative">
          <VideoPlayer src={videoUrl} />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white
                       rounded-full w-8 h-8 flex items-center justify-center shadow-lg transition-colors"
            aria-label="Futa video"
          >
            <i className="ti ti-x text-sm" aria-hidden="true" />
          </button>
        </div>
        {compressInfo && (
          <p className="text-xs text-gray-400">
            <i className="ti ti-package" aria-hidden="true" /> Imepunguzwa: {compressInfo.from} → {compressInfo.to}
          </p>
        )}
        <p className="text-xs text-green-600 flex items-center gap-1">
          <i className="ti ti-circle-check" aria-hidden="true" /> Video imepakiwa
        </p>
      </div>
    )
  }

  // ── Compressing / Uploading: progress ─────────────────────────────────────
  if (stage === 'compressing' || stage === 'uploading') {
    const isCompressing = stage === 'compressing'
    const barColor      = isCompressing ? 'bg-amber-500' : 'bg-primary-500'
    const bgColor       = isCompressing ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'

    return (
      <div className={`border rounded-2xl p-5 space-y-4 ${bgColor}`}>
        {/* Steps indicator */}
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className={`flex items-center gap-1 ${isCompressing ? 'text-amber-700' : 'text-green-600'}`}>
            {isCompressing
              ? <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              : <i className="ti ti-circle-check" aria-hidden="true" />
            }
            Punguza
          </span>
          <div className="flex-1 h-px bg-gray-200" />
          <span className={`flex items-center gap-1 ${!isCompressing ? 'text-primary-700' : 'text-gray-400'}`}>
            {!isCompressing
              ? <span className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              : <span className="w-3 h-3 rounded-full border border-gray-300" />
            }
            Pakia
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 truncate pr-2">{statusText}</span>
            <span className="font-medium text-gray-700 flex-shrink-0">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-300 ${barColor}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-1">
          <i className="ti ti-lock" aria-hidden="true" /> Usifunge ukurasa huu
          {!isCompressing && fileSize > 0 && (
            <span className="ml-1">· {formatMB(fileSize)}</span>
          )}
        </p>
      </div>
    )
  }

  // ── Idle / Error: file picker ──────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/3gpp,video/3gpp2,.mp4,.mov,.webm,.avi,.3gp,.3g2"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"  // Opens camera directly on mobile
        className="hidden"
        onChange={handleInputChange}
      />

      {/* ── Mobile: two clear buttons side by side ── */}
      {isMobile ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all
              ${stage === 'error' ? 'border-red-200 bg-red-50' : 'border-primary-200 bg-primary-50 active:scale-95'}`}
          >
            <i className="ti ti-camera text-2xl text-primary-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-primary-700">Rekodi Sasa</span>
            <span className="text-xs text-primary-500">Tumia kamera</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center gap-2 py-4 rounded-2xl border-2 transition-all
              ${stage === 'error' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50 active:scale-95'}`}
          >
            <i className="ti ti-folder-open text-2xl text-gray-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-gray-700">Chagua Faili</span>
            <span className="text-xs text-gray-400">Kutoka galauni</span>
          </button>
        </div>
      ) : (
        /* ── Desktop: drag-and-drop zone ── */
        <div
          onClick={() => inputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer
                      transition-all space-y-1.5 ${
            stage === 'error'
              ? 'border-red-200 bg-red-50'
              : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
          }`}
        >
          <i className={`ti ti-video text-3xl ${stage === 'error' ? 'text-red-400' : 'text-gray-400'}`} aria-hidden="true" />
          <p className={`text-sm font-medium ${stage === 'error' ? 'text-red-600' : 'text-gray-600'}`}>
            Buruta video hapa au bonyeza kuchagua
          </p>
          <p className="text-xs text-gray-400">MP4, MOV, WebM, AVI · Max {MAX_MB}MB</p>
        </div>
      )}

      {/* Tips */}
      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-1">
        <p className="text-xs text-gray-500 flex items-start gap-1.5">
          <i className="ti ti-bulb flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            Video inasaidia wateja kuona nyumba vizuri.
            {canCompress()
              ? ` Video kubwa (zaidi ya ${COMPRESS_ABOVE_MB}MB) itapunguzwa otomatiki.`
              : ` Rekoodi video fupi (chini ya dakika 1) kwa ubora wa chini zaidi kupunguza ukubwa.`
            }
          </span>
        </p>
        {isMobile && (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <i className="ti ti-wifi-off flex-shrink-0" aria-hidden="true" />
            Muunganiko dhaifu? Rekoodi video ya sekunde 30–60 tu.
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-3">
          <p className="text-xs text-red-600 flex items-start gap-1.5">
            <i className="ti ti-alert-triangle flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </p>
          <button
            type="button"
            onClick={() => { setError(''); setStage('idle'); if (isMobile) { cameraInputRef.current?.click() } else { inputRef.current?.click() } }}
            className="mt-2 text-xs text-red-500 underline"
          >
            Jaribu tena
          </button>
        </div>
      )}
    </div>
  )
}
