'use client'

import { useRef, useState } from 'react'

export interface PendingAttachment {
  url: string
  file_name: string
  file_type: string
  file_size: number
  preview?: string  // data URL for image preview
}

interface Props {
  onAttach: (a: PendingAttachment) => void
  onRemove: () => void
  attachment: PendingAttachment | null
}

const ALLOWED = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/ogg,video/3gpp,application/pdf'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentCompose({ onAttach, onRemove, attachment }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)

    // Preview for images
    let preview: string | undefined
    if (file.type.startsWith('image/')) {
      preview = await new Promise<string>((res) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result as string)
        reader.readAsDataURL(file)
      })
    }

    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/v1/upload/message-attachment', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (!res.ok || !json.url) {
      setError(json.error ?? 'Haikuweza kupakia faili')
      return
    }
    onAttach({ ...json, preview })
  }

  if (attachment) {
    const isImage = attachment.file_type.startsWith('image/')
    const isVid   = attachment.file_type.startsWith('video/')
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-sm">
        {isImage && attachment.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachment.preview} alt="" className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
        ) : isVid ? (
          <div className="w-10 h-10 flex items-center justify-center bg-blue-100 rounded-lg flex-shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        ) : (
          <div className="w-10 h-10 flex items-center justify-center bg-red-100 rounded-lg flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{attachment.file_name}</p>
          <p className="text-xs text-gray-400">{humanSize(attachment.file_size)}</p>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = '' } }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Ambatanisha faili"
        className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-primary-500 hover:border-primary-300 transition-colors disabled:opacity-40 flex-shrink-0"
      >
        {uploading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
