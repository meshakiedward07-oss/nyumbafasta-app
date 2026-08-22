'use client'

interface Props {
  url: string
  title: string
  onClose: () => void
}

// Shows a PDF (e.g. a dalali's business license) inline via <iframe>, instead
// of just linking out to the raw Cloudinary URL in a new tab. Browsers render
// PDFs natively inside an iframe, so no extra viewer library is needed.
export default function PdfViewerModal({ url, title, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/70 flex flex-col"
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 bg-white px-4 py-3 border-b border-gray-200 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-gray-800 truncate flex items-center gap-2">
          <i className="ti ti-file-type-pdf text-red-500 text-lg" aria-hidden="true" />
          {title}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-primary-50"
          >
            <i className="ti ti-external-link" aria-hidden="true" /> Tab Mpya
          </a>
          <button
            onClick={onClose}
            aria-label="Funga"
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
          >
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-gray-100" onClick={e => e.stopPropagation()}>
        <iframe src={url} title={title} className="w-full h-full border-0" />
      </div>
    </div>
  )
}
