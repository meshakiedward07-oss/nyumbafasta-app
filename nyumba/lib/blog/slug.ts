// Converts a blog post title into a URL-safe slug. Kept intentionally
// simple (no external deps) — matches how the rest of this app builds
// URL-safe strings (see regionSlug() in app/sitemap.ts).
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}
