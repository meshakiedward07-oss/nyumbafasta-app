import DOMPurify from 'isomorphic-dompurify'

// Blog content is authored only by trusted admin/staff (never public
// user-submitted content), but we still sanitize on both write and read as
// defense-in-depth — a compromised staff account or an accidental paste of
// something malicious into the editor should never be able to inject a
// script into a public page. Allowlist covers exactly what RichTextEditor
// (components/admin/RichTextEditor.tsx) can actually produce.
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'code', 'pre',
  'span', 'div',
]
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel']

export function sanitizeBlogHtml(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })
}
