'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  existingVideoUrl?: string | null
  onUploadComplete: (url: string) => void
  onRemove?: () => void
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/avi']
const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export function VideoUpload({ existingVideoUrl, onUploadComplete, onRemove }: Props) {
  const [videoUrl, setVideoUrl] = useState(existingVideoUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError('')

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Aina haifai. Tumia MP4, MOV, au WebM')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Video ni kubwa mno. Max 50MB')
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Ingia kwanza kabla ya kupakia video')
        setUploading(false)
        return
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4'
      const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const uploadUrl = `${base}/storage/v1/object/listing-videos/${path}`

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        })

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const publicUrl = `${base}/storage/v1/object/public/listing-videos/${path}`
            setVideoUrl(publicUrl)
            onUploadComplete(publicUrl)
            resolve()
          } else {
            try {
              const body = JSON.parse(xhr.responseText)
              reject(new Error(body.error || `Upload ilishindwa (${xhr.status})`))
            } catch {
              reject(new Error(`Upload ilishindwa (${xhr.status})`))
            }
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Hitilafu ya mtandao')))

        xhr.open('POST', uploadUrl)
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(file)
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kupakia video')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function handleRemove() {
    setVideoUrl('')
    if (inputRef.current) inputRef.current.value = ''
    onRemove?.()
  }

  if (videoUrl) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full bg-black"
            style={{ maxHeight: 200 }}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7
                       flex items-center justify-center text-sm font-bold shadow"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-green-600">✅ Video imepakiwa kwa mafanikio</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/avi"
        className="hidden"
        disabled={uploading}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        disabled={uploading}
        className="w-full h-24 border-2 border-dashed border-gray-200 rounded-xl
                   flex flex-col items-center justify-center gap-1.5
                   text-gray-400 disabled:opacity-60 active:scale-95 transition-all"
      >
        {uploading ? (
          <div className="w-full px-6 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span className="text-xs text-primary-600 font-medium">Inapakia... {progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">Usifunge ukurasa huu</p>
          </div>
        ) : (
          <>
            <span className="text-2xl">🎥</span>
            <span className="text-xs font-medium">Bonyeza kupakia video</span>
            <span className="text-xs text-gray-300">MP4, MOV, WebM — max 50MB</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-red-500 text-xs flex items-center gap-1">
          <span>⚠️</span> {error}
        </p>
      )}
    </div>
  )
}
