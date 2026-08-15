'use client'

import { useLanguage } from '@/lib/i18n/context'

interface Attachment {
  id?: string
  file_url: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
}

function humanSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentDisplay({ attachments }: { attachments: Attachment[] }) {
  const { t } = useLanguage()
  if (!attachments.length) return null

  return (
    <div className="mt-1.5 space-y-1.5">
      {attachments.map((a, i) => {
        const isImage = a.file_type?.startsWith('image/') ?? false
        const isVideo = a.file_type?.startsWith('video/') ?? false
        if (isImage) {
          return (
            <a key={a.id ?? i} href={a.file_url} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.file_url}
                alt={a.file_name ?? t('pr_attach_img_alt')}
                className="max-w-[240px] rounded-xl border border-black/10 object-cover"
              />
            </a>
          )
        }
        if (isVideo) {
          return (
            <video
              key={a.id ?? i}
              src={a.file_url}
              controls
              playsInline
              className="max-w-[280px] rounded-xl border border-black/10 bg-black"
              style={{ maxHeight: '200px' }}
            />
          )
        }
        return (
          <a
            key={a.id ?? i}
            href={a.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-white/20 dark:bg-black/20 rounded-xl hover:bg-white/30 transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{a.file_name ?? t('pr_attach_file_fallback')}</p>
              {a.file_size && <p className="text-[10px] opacity-70">{humanSize(a.file_size)}</p>}
            </div>
            <svg className="w-3.5 h-3.5 flex-shrink-0 opacity-60 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        )
      })}
    </div>
  )
}
