'use client'
import { useRef, useCallback, useEffect } from 'react'

// Lightweight WYSIWYG for blog content — deliberately zero-dependency
// (contentEditable + document.execCommand) rather than pulling in a full
// editor library (Tiptap/Quill/etc). Covers exactly what a blog post needs:
// headings, bold/italic/underline, lists, quotes, links, and images
// (uploaded straight to Cloudinary via the same endpoint the verify wizard
// and listing photos already use). execCommand is deprecated but still
// broadly supported in every browser an admin/staff member would use for
// this internal tool, and it means one less dependency to keep updated.
type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

const BTN = 'w-8 h-8 rounded-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:scale-95 transition-all'

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync from props → DOM only when it actually differs from what's live in
  // the editor right now (comparing against the DOM itself, not a shadow
  // ref) — this both (a) correctly paints the initial content on mount when
  // editing an existing post, which the previous ref-based guard skipped
  // entirely (a useRef(value) initializer already equals `value` at mount,
  // so "value !== lastValueRef.current" was always false the first time —
  // the editor rendered blank for every existing post, and typing so much
  // as one character would overwrite the whole saved post with just that
  // keystroke on next save), and (b) still never fights the cursor while
  // typing, since after emit() updates the DOM directly there's nothing
  // left to resync.
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const emit = useCallback(() => {
    // Browsers often leave a lone <br> behind when every character is
    // deleted, so the div is no longer truly :empty and the CSS placeholder
    // (empty:before:content-…) stops showing even though the post looks
    // blank to the author. Normalize that one case back to real emptiness.
    if (editorRef.current?.innerHTML === '<br>') editorRef.current.innerHTML = ''
    const html = editorRef.current?.innerHTML ?? ''
    onChange(html)
  }, [onChange])

  function exec(cmd: string, arg?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
  }

  function handleLink() {
    const raw = window.prompt('Weka link (URL):', 'https://')
    if (!raw) return
    const trimmed = raw.trim()
    if (!trimmed || trimmed === 'https://') return
    // Bare domains/paths (e.g. "nyumbafasta.co/blog") would otherwise become
    // a broken relative link — default to https:// when no scheme is given.
    const url = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
    exec('createLink', url)
  }

  // Inserted manually via the Range API (not execCommand('insertImage'),
  // which has no way to set alt text) so every content image can carry real
  // alt text — both for accessibility and because Google Images indexing is
  // part of why this feature exists at all.
  function insertImageAtCursor(url: string, alt: string) {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const img = document.createElement('img')
    img.src = url
    img.alt = alt
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(img)
      range.setStartAfter(img)
      range.setEndAfter(img)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editor.appendChild(img)
    }
    emit()
  }

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!data.url) throw new Error(data.error ?? 'Upload imeshindwa')
      const alt = window.prompt('Maelezo mafupi ya picha (alt text — kwa SEO na watu wenye ulemavu wa macho):', '') ?? ''
      insertImageAtCursor(data.url, alt.trim())
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Imeshindwa kupakia picha')
    }
  }

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-gray-100 bg-gray-50">
        <button type="button" title="Bold" className={BTN} onClick={() => exec('bold')}><i className="ti ti-bold" aria-hidden="true" /></button>
        <button type="button" title="Italic" className={BTN} onClick={() => exec('italic')}><i className="ti ti-italic" aria-hidden="true" /></button>
        <button type="button" title="Underline" className={BTN} onClick={() => exec('underline')}><i className="ti ti-underline" aria-hidden="true" /></button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" title="Kichwa H2" className={`${BTN} text-xs font-bold`} onClick={() => exec('formatBlock', '<h2>')}>H2</button>
        <button type="button" title="Kichwa H3" className={`${BTN} text-xs font-bold`} onClick={() => exec('formatBlock', '<h3>')}>H3</button>
        <button type="button" title="Aya ya kawaida" className={`${BTN} text-xs font-bold`} onClick={() => exec('formatBlock', '<p>')}>P</button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" title="Orodha" className={BTN} onClick={() => exec('insertUnorderedList')}><i className="ti ti-list" aria-hidden="true" /></button>
        <button type="button" title="Orodha ya namba" className={BTN} onClick={() => exec('insertOrderedList')}><i className="ti ti-list-numbers" aria-hidden="true" /></button>
        <button type="button" title="Nukuu" className={BTN} onClick={() => exec('formatBlock', '<blockquote>')}><i className="ti ti-quote" aria-hidden="true" /></button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" title="Weka link" className={BTN} onClick={handleLink}><i className="ti ti-link" aria-hidden="true" /></button>
        <button type="button" title="Weka picha" className={BTN} onClick={() => fileInputRef.current?.click()}><i className="ti ti-photo" aria-hidden="true" /></button>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" title="Tendua" className={BTN} onClick={() => exec('undo')}><i className="ti ti-arrow-back-up" aria-hidden="true" /></button>
        <button type="button" title="Rudia" className={BTN} onClick={() => exec('redo')}><i className="ti ti-arrow-forward-up" aria-hidden="true" /></button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        className="blog-content px-4 py-3 min-h-[280px] max-h-[560px] overflow-y-auto text-sm text-gray-800 leading-relaxed focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  )
}
