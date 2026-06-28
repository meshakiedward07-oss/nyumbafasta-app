'use client'
import { useState, useRef, useCallback } from 'react'
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
  'video/x-msvideo', 'video/3gpp', 'video/x-matroska',
]
const ALLOWED_EXTS  = ['.mp4', '.mov', '.webm', '.avi', '.3gp', '.mkv']
const MAX_MB        = 500
const COMPRESS_ABOVE_MB = 50

type Stage = 'idle' | 'compressing' | 'uploading' | 'done' | 'error'

export function VideoUpload({ existingVideoUrl, onUploadComplete, onRemove }: Props) {
  const [videoUrl, setVideoUrl]     = useState(existingVideoUrl ?? '')
  const [stage, setStage]           = useState<Stage>(existingVideoUrl ? 'done' : 'idle')
  const [progress, setProgress]     = useState(0)
  const [statusText, setStatusText] = useState('')
  const [error, setError]           = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [compressInfo, setCompressInfo] = useState<{ from: string; to: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setCompressInfo(null)

    // Validate type
    const validType = ALLOWED_TYPES.includes(file.type)
    const validExt  = ALLOWED_EXTS.some(e => file.name.toLowerCase().endsWith(e))
    if (!validType && !validExt) {
      setError('Aina haifai. Tumia MP4, MOV, WebM, au AVI')
      setStage('error')
      return
    }

    // Hard max
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Video ni kubwa mno. Max ${MAX_MB}MB`)
      setStage('error')
      return
    }

    const needsCompression = file.size > COMPRESS_ABOVE_MB * 1024 * 1024
    let fileToUpload = file

    // ── Compression ────────────────────────────────────────────────────────
    if (needsCompression) {
      if (!canCompress()) {
        setError(
          `Video ni kubwa mno (${(file.size / 1024 / 1024).toFixed(0)}MB). ` +
          `Kivinjari chako hakisaidii kupunguza video. Tumia MP4 chini ya ${COMPRESS_ABOVE_MB}MB.`
        )
        setStage('error')
        return
      }

      setStage('compressing')
      setProgress(0)
      setStatusText('Inasoma video...')

      const result: CompressResult = await compressVideo(file, (pct) => {
        setProgress(pct)
        setStatusText(
          pct < 15 ? 'Inasoma video...' :
          pct < 90 ? `Inapunguza ukubwa... ${pct}%` :
          'Inakamilisha upunguzaji...'
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

    // ── Upload ─────────────────────────────────────────────────────────────
    setStage('uploading')
    setProgress(0)
    setStatusText('Inaanza kupakia...')

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
            setStatusText(
              pct < 30 ? 'Inaanza kupakia...' :
              pct < 80 ? `Inapakia... ${pct}%` :
              'Karibu kukamilika...'
            )
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve(`${base}/storage/v1/object/public/listing-videos/${path}`)
          } else {
            try {
              const body = JSON.parse(xhr.responseText)
              reject(new Error(body.error || `Imeshindwa (${xhr.status})`))
            } catch {
              reject(new Error(`Imeshindwa (${xhr.status})`))
            }
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Hitilafu ya mtandao')))
        xhr.addEventListener('timeout', () => reject(new Error('Muda umekwisha — jaribu tena')))

        xhr.timeout = 600_000 // 10 minutes
        xhr.open('POST', `${base}/storage/v1/object/listing-videos/${path}`)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('Content-Type', fileToUpload.type || 'video/mp4')
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.setRequestHeader('cache-control', '31536000') // 1 year browser cache
        xhr.send(fileToUpload)
      })

      setVideoUrl(publicUrl)
      setStage('done')
      setProgress(100)
      onUploadComplete(publicUrl)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kupakia video')
      setStage('error')
    }
  }, [onUploadComplete])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function handleRemove() {
    setVideoUrl('')
    setStage('idle')
    setProgress(0)
    setError('')
    setCompressInfo(null)
    if (inputRef.current) inputRef.current.value = ''
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
                       rounded-full w-7 h-7 flex items-center justify-center text-sm
                       font-bold shadow transition-colors"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {compressInfo && (
          <p className="text-xs text-gray-400">
            <i className="ti ti-package" aria-hidden="true" /> Imepunguzwa: {compressInfo.from} → {compressInfo.to}
          </p>
        )}
        <p className="text-xs text-green-600 flex items-center gap-1"><i className="ti ti-circle-check" aria-hidden="true" />Video imepakiwa kwa mafanikio</p>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />{error}</p>
        )}
      </div>
    )
  }

  // ── Compressing / Uploading: progress ────────────────────────────────────
  if (stage === 'compressing' || stage === 'uploading') {
    const isCompressing = stage === 'compressing'
    return (
      <div className="border-2 border-dashed border-blue-200 rounded-xl p-6 bg-blue-50 space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-700 truncate">{statusText}</p>
            <div className="mt-1.5 w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-xs text-blue-500 flex-shrink-0">{progress}%</span>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs">
          <span className={`flex items-center gap-1 ${
            isCompressing ? 'text-blue-600 font-medium' : 'text-green-600'
          }`}>
            {isCompressing ? <i className="ti ti-hourglass" aria-hidden="true" /> : <i className="ti ti-circle-check" aria-hidden="true" />} Punguza
          </span>
          <span className="text-gray-300">──</span>
          <span className={`flex items-center gap-1 ${
            !isCompressing ? 'text-blue-600 font-medium' : 'text-blue-200'
          }`}>
            {!isCompressing ? <i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> : <span className="inline-block w-2 h-2 rounded-full border border-current align-middle" />} Pakia
          </span>
        </div>

        <p className="text-xs text-blue-400 text-center">Usifunge ukurasa huu</p>
      </div>
    )
  }

  // ── Idle / Error: drop zone ────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/3gpp,.mp4,.mov,.webm,.avi,.3gp"
        className="hidden"
        onChange={handleInputChange}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                    transition-all space-y-1.5 ${
          isDragging
            ? 'border-green-400 bg-green-50 scale-[1.01]'
            : stage === 'error'
            ? 'border-red-200 bg-red-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span className="text-3xl block">
          {isDragging ? <i className="ti ti-folder-open" aria-hidden="true" /> : stage === 'error' ? <i className="ti ti-alert-triangle" aria-hidden="true" /> : <i className="ti ti-video" aria-hidden="true" />}
        </span>
        <p className={`text-sm font-medium ${
          isDragging ? 'text-green-700' : stage === 'error' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {isDragging ? 'Acha video hapa...' : 'Buruta video hapa au bonyeza kuchagua'}
        </p>
        <p className="text-xs text-gray-400">MP4, MOV, WebM, AVI · Max 500MB</p>
        {canCompress() && (
          <span className="inline-block text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            <i className="ti ti-package" aria-hidden="true" /> Video kubwa inapunguzwa otomatiki
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> {error}
        </p>
      )}

      <p className="text-xs text-gray-400">
        <i className="ti ti-bulb" aria-hidden="true" /> Video inasaidia wateja kuona nyumba vizuri zaidi
      </p>
    </div>
  )
}
