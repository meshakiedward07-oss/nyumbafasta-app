import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

// Blog posts are written occasionally via the admin panel, not on every
// request — mirrors the revalidate convention used by every other public
// SEO page in this app (directory, mali/[region], dalali/[id], agent/[username]).
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Blog — NyumbaFasta | Vidokezo vya Nyumba na Uwekezaji Tanzania',
  description: 'Vidokezo vya kupanga nyumba, uwekezaji wa mali, na habari za soko la nyumba Tanzania kutoka NyumbaFasta.',
  alternates: { canonical: `${APP_URL}/blog` },
  openGraph: {
    title: 'Blog — NyumbaFasta',
    description: 'Vidokezo vya kupanga nyumba, uwekezaji wa mali, na habari za soko la nyumba Tanzania.',
    url: `${APP_URL}/blog`,
    type: 'website',
  },
}

type BlogListItem = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  category: string | null
  author_name: string | null
  published_at: string | null
}

async function getPublishedPosts(): Promise<BlogListItem[]> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('blog_posts')
      .select('id, title, slug, excerpt, cover_image_url, category, author_name, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(60)
    return data ?? []
  } catch {
    return []
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Blog ya NyumbaFasta</h1>
        <p className="text-sm text-gray-500 mt-1">Vidokezo vya kupanga nyumba, uwekezaji wa mali, na habari za soko Tanzania.</p>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-sm text-gray-500">Bado hakuna machapisho. Rudi hivi karibuni!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {posts.map(post => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="relative w-full aspect-video bg-gray-100">
                {post.cover_image_url ? (
                  <Image fill src={post.cover_image_url} alt={post.title} className="object-cover" sizes="(max-width: 640px) 100vw, 380px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="ti ti-notes text-3xl text-gray-300" aria-hidden="true" />
                  </div>
                )}
              </div>
              <div className="p-4">
                {post.category && (
                  <span className="inline-block text-[11px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full mb-2">{post.category}</span>
                )}
                <h2 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{post.title}</h2>
                {post.excerpt && (
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                )}
                <p className="text-[11px] text-gray-400 mt-3">
                  {post.author_name ?? 'NyumbaFasta'} · {fmtDate(post.published_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
