'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { slugify } from '@/lib/blog/slug'

type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content_html?: string
  cover_image_url: string | null
  category: string | null
  tags?: string[]
  status: 'draft' | 'published'
  author_id: string | null
  author_name: string | null
  meta_title?: string | null
  meta_description?: string | null
  view_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

const CATEGORY_SUGGESTIONS = [
  'Vidokezo vya Kupanga', 'Mwongozo wa Ununuzi', 'Uwekezaji wa Mali',
  'Habari za Soko', 'Maisha Jijini', 'NyumbaFasta News',
]

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `dakika ${mins} zilizopita`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `masaa ${hrs} yaliyopita`
  return `siku ${Math.floor(hrs / 24)} zilizopita`
}

function StatusPill({ status }: { status: string }) {
  return status === 'published' ? (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Imechapishwa</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">Rasimu</span>
  )
}

const emptyDraft = {
  id: null as string | null,
  title: '', slug: '', excerpt: '', content_html: '',
  cover_image_url: '', category: '', tagsText: '',
  meta_title: '', meta_description: '',
  slugTouched: false,
}

export default function BlogTab() {
  const [posts, setPosts]     = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState<'list' | 'editor'>('list')
  const [scope, setScope]     = useState<'all' | 'mine'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [toast, setToast]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [draft, setDraft] = useState(emptyDraft)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (scope === 'mine') params.set('mine', '1')
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/v1/social/blog?${params.toString()}`)
      const data = await res.json() as { posts?: BlogPost[]; error?: string }
      setPosts(data.posts ?? [])
    } catch {
      showToast('Imeshindwa kupakua machapisho')
    } finally {
      setLoading(false)
    }
  }, [scope, statusFilter])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  function openNew() {
    setDraft(emptyDraft)
    setView('editor')
  }

  async function openEdit(id: string) {
    try {
      const res = await fetch(`/api/v1/social/blog/${id}`)
      const data = await res.json() as { post?: BlogPost & { tags?: string[] }; error?: string }
      if (!data.post) { showToast('Haikupatikana'); return }
      const p = data.post
      setDraft({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? '',
        content_html: p.content_html ?? '',
        cover_image_url: p.cover_image_url ?? '',
        category: p.category ?? '',
        tagsText: (p.tags ?? []).join(', '),
        meta_title: p.meta_title ?? '',
        meta_description: p.meta_description ?? '',
        slugTouched: true,
      })
      setView('editor')
    } catch {
      showToast('Imeshindwa kupakua andiko')
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Una uhakika unataka kufuta "${title}"? Hatua hii haiwezi kutenduliwa.`)) return
    try {
      const res = await fetch(`/api/v1/social/blog/${id}`, { method: 'DELETE' })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!data.success) throw new Error(data.error ?? 'Imeshindwa')
      showToast('Andiko limefutwa')
      fetchPosts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Imeshindwa kufuta')
    }
  }

  async function handleCoverPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
      const data = await res.json() as { url?: string; error?: string }
      if (!data.url) throw new Error(data.error ?? 'Upload imeshindwa')
      setDraft(d => ({ ...d, cover_image_url: data.url! }))
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Imeshindwa kupakia picha')
    } finally {
      setCoverUploading(false)
    }
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!draft.title.trim()) { showToast('Weka kichwa cha habari kwanza'); return }
    setSaving(true)
    try {
      const payload = {
        title: draft.title.trim(),
        slug: draft.slug.trim() || slugify(draft.title),
        excerpt: draft.excerpt.trim(),
        content_html: draft.content_html,
        cover_image_url: draft.cover_image_url,
        category: draft.category.trim(),
        tags: draft.tagsText.split(',').map(t => t.trim()).filter(Boolean),
        meta_title: draft.meta_title.trim(),
        meta_description: draft.meta_description.trim(),
        status,
      }
      const res = await fetch(
        draft.id ? `/api/v1/social/blog/${draft.id}` : '/api/v1/social/blog',
        { method: draft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
      )
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Imeshindwa kuhifadhi')

      showToast(status === 'published' ? 'Imechapishwa! 🎉' : 'Rasimu imehifadhiwa')
      setView('list')
      fetchPosts()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Imeshindwa kuhifadhi')
    } finally {
      setSaving(false)
    }
  }

  // ── Editor view ────────────────────────────────────────────────────────
  if (view === 'editor') {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('list')} className="text-sm text-gray-500 flex items-center gap-1">
            <i className="ti ti-arrow-left" aria-hidden="true" /> Rudi kwenye orodha
          </button>
          {draft.id && draft.slug && (
            <span className="text-xs text-gray-400">/blog/{draft.slug}</span>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kichwa cha Habari</label>
          <input
            value={draft.title}
            onChange={e => setDraft(d => ({
              ...d, title: e.target.value,
              slug: d.slugTouched ? d.slug : slugify(e.target.value),
            }))}
            placeholder="Mfano: Vidokezo 5 vya Kupata Nyumba Bora Dar es Salaam"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium focus:border-primary-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Slug (URL)</label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-shrink-0">{SITE_URL}/blog/</span>
            <input
              value={draft.slug}
              onChange={e => setDraft(d => ({ ...d, slug: slugify(e.target.value), slugTouched: true }))}
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Muhtasari Mfupi (excerpt)</label>
          <textarea
            value={draft.excerpt}
            onChange={e => setDraft(d => ({ ...d, excerpt: e.target.value }))}
            rows={2}
            maxLength={220}
            placeholder="Sentensi 1-2 zinazoonekana kwenye orodha ya blog na kwenye Google"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:outline-none resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">{draft.excerpt.length}/220</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Picha ya Jalada</label>
          {draft.cover_image_url ? (
            <div className="mt-1 relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100">
              <Image fill src={draft.cover_image_url} alt="" className="object-cover" unoptimized sizes="600px" />
              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, cover_image_url: '' }))}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center"
              ><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
          ) : (
            <button
              type="button"
              disabled={coverUploading}
              onClick={() => coverInputRef.current?.click()}
              className="mt-1 w-full aspect-video border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 bg-gray-50 disabled:opacity-50"
            >
              {coverUploading
                ? <span className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                : <><i className="ti ti-photo-plus text-2xl" aria-hidden="true" /><span className="text-xs">Bofya kupakia picha ya jalada</span></>}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategoria</label>
            <input
              list="blog-categories"
              value={draft.category}
              onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
              placeholder="Mfano: Uwekezaji wa Mali"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
            />
            <datalist id="blog-categories">
              {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tags (vitenganishwa na koma)</label>
            <input
              value={draft.tagsText}
              onChange={e => setDraft(d => ({ ...d, tagsText: e.target.value }))}
              placeholder="kodi, dar es salaam, wapangaji"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Maudhui ya Habari</label>
          <RichTextEditor
            value={draft.content_html}
            onChange={html => setDraft(d => ({ ...d, content_html: html }))}
            placeholder="Andika habari yako hapa…"
          />
        </div>

        <details className="rounded-xl border border-gray-100 p-3">
          <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer">SEO ya Ziada (hiari)</summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs text-gray-500">Meta Title (kama ni tofauti na kichwa)</label>
              <input
                value={draft.meta_title}
                onChange={e => setDraft(d => ({ ...d, meta_title: e.target.value }))}
                maxLength={70}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Meta Description</label>
              <textarea
                value={draft.meta_description}
                onChange={e => setDraft(d => ({ ...d, meta_description: e.target.value }))}
                rows={2}
                maxLength={160}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none resize-none"
              />
            </div>
          </div>
        </details>

        <div className="fixed bottom-0 left-0 right-0 lg:sticky lg:bottom-4 bg-white border-t lg:border border-gray-100 lg:rounded-2xl p-3 flex gap-2 shadow-lg lg:shadow-sm z-10">
          <button
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 text-sm font-semibold disabled:opacity-50"
          >Hifadhi Rasimu</button>
          <button
            disabled={saving}
            onClick={() => handleSave('published')}
            className="flex-1 py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold disabled:opacity-50"
          >{saving ? 'Inahifadhi…' : 'Chapisha Sasa'}</button>
        </div>

        {toast && (
          <div className="fixed bottom-24 lg:bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-20">{toast}</div>
        )}
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(['all', 'mine'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                scope === s ? 'bg-primary-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>{s === 'all' ? 'Machapisho Yote' : 'Yangu Tu'}</button>
          ))}
          <span className="w-px bg-gray-200 mx-1" />
          {(['all', 'draft', 'published'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                statusFilter === s ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>{s === 'all' ? 'Zote' : s === 'draft' ? 'Rasimu' : 'Zilizochapishwa'}</button>
          ))}
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all">
          <i className="ti ti-plus" aria-hidden="true" /> Andika Blog Mpya
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Inapakia…</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <i className="ti ti-notes text-4xl text-gray-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-gray-600 mt-2">Hakuna machapisho bado</p>
          <p className="text-xs text-gray-400 mt-1">Bofya &quot;Andika Blog Mpya&quot; kuanza</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-3 items-center">
              <div className="relative w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {p.cover_image_url ? (
                  <Image fill src={p.cover_image_url} alt="" className="object-cover" unoptimized sizes="64px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><i className="ti ti-notes text-xl text-gray-300" aria-hidden="true" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{p.title}</p>
                  <StatusPill status={p.status} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {p.author_name ?? 'Mwandishi'} · {timeAgo(p.updated_at)}
                  {p.status === 'published' && <> · <i className="ti ti-eye" aria-hidden="true" /> {p.view_count}</>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {p.status === 'published' && (
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                    <i className="ti ti-external-link" aria-hidden="true" />
                  </a>
                )}
                <button onClick={() => openEdit(p.id)} className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500">
                  <i className="ti ti-edit" aria-hidden="true" />
                </button>
                <button onClick={() => handleDelete(p.id, p.title)} className="w-9 h-9 rounded-xl border border-red-100 flex items-center justify-center text-red-500">
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 lg:bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-4 py-2 rounded-full shadow-lg z-20">{toast}</div>
      )}
    </div>
  )
}
