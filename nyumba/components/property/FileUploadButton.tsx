'use client'
import { useRef, useState } from 'react'

interface FileUploadButtonProps {
  value: string
  onChange: (url: string) => void
  label?: string
  accept?: string
}

export function FileUploadButton({ value, onChange, label = 'Pakia Faili', accept = 'image/*' }: FileUploadButtonProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) { setError(data.error ?? 'Upload ilishindwa'); return }
      onChange(data.url)
    } catch {
      setError('Haikuweza kupakia. Jaribu tena.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://... au pakia faili →"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2.5 border border-primary-200 bg-primary-50 text-primary-700 rounded-xl text-xs font-semibold hover:bg-primary-100 transition disabled:opacity-50 flex-shrink-0"
        >
          {uploading
            ? <><i className="ti ti-loader-2 animate-spin" /> Inapakia...</>
            : <><i className="ti ti-upload" /> {label}</>
          }
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {value && (
        <a href={value} target="_blank" rel="noopener noreferrer"
          className="text-xs text-primary-600 hover:underline flex items-center gap-1">
          <i className="ti ti-external-link text-xs" /> Angalia faili lililopo
        </a>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFile} />
    </div>
  )
}
