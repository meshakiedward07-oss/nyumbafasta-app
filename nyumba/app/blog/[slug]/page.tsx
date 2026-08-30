import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'
import { sanitizeBlogHtml } from '@/lib/blog/sanitize'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'

export const revalidate = 3600

type BlogPostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content_html: string
  cover_image_url: string | null
  category: string | null
  tags: string[] | null
  author_name: string | null
  meta_title: string | null
  meta_description: string | null
  published_at: string | null
  updated_at: string
}

const getPost = cache(async function getPost(slug: string): Promise<BlogPostRow | null> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('blog_posts')
      .select('id, title, slug, excerpt, content_html, cover_image_url, category, tags, author_name, meta_title, meta_description, published_at, updated_at')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
    return (data as BlogPostRow) ?? null
  } catch {
    return null
  }
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) return { title: 'Blog | NyumbaFasta' }

  const title = post.meta_title || `${post.title} — NyumbaFasta Blog`
  const description = post.meta_description || post.excerpt || `Soma "${post.title}" kwenye blog ya NyumbaFasta.`
  const url = `${APP_URL}/blog/${post.slug}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      images: post.cover_image_url ? [{ url: post.cover_image_url }] : undefined,
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
    },
    twitter: {
      card: post.cover_image_url ? 'summary_large_image' : 'summary',
      title,
      description,
    },
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Best-effort view counter — awaited (not truly fire-and-forget): on Vercel's
// serverless runtime an un-awaited promise left running after the page
// component returns has no guarantee of finishing before the function
// instance is frozen/torn down, so views would go uncounted unpredictably.
// The added latency is one small UPDATE query; failures never block the page.
async function bumpViewCount(id: string) {
  try {
    const admin = createAdminClient()
    await admin.rpc('increment_blog_view_count', { p_post_id: id })
  } catch {
    // non-fatal
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  await bumpViewCount(post.id)

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? post.meta_description ?? undefined,
    image: post.cover_image_url ?? undefined,
    datePublished: post.published_at ?? post.updated_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: post.author_name ?? 'NyumbaFasta' },
    publisher: {
      '@type': 'Organization',
      name: 'NyumbaFasta',
      logo: { '@type': 'ImageObject', url: `${APP_URL}/transparent_logo_nyumbafasta.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${APP_URL}/blog/${post.slug}` },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <article className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/blog" className="text-xs text-primary-600 hover:underline flex items-center gap-1 mb-4">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Blog Zote
        </Link>

        {post.category && (
          <span className="inline-block text-[11px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full mb-3">{post.category}</span>
        )}

        <h1 className="text-2xl font-bold text-gray-900 leading-snug">{post.title}</h1>
        <p className="text-xs text-gray-400 mt-2">
          {post.author_name ?? 'NyumbaFasta'} · {fmtDate(post.published_at)}
        </p>

        {post.cover_image_url && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 mt-5">
            <Image fill priority src={post.cover_image_url} alt={post.title} className="object-cover" sizes="(max-width: 768px) 100vw, 672px" />
          </div>
        )}

        <div
          className="blog-content mt-6"
          dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(post.content_html) }}
        />

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-100">
            {post.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">#{tag}</span>
            ))}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-100 bg-primary-50 rounded-2xl p-5 text-center">
          <p className="text-sm font-semibold text-gray-800">Unatafuta nyumba au unataka kutangaza mali yako?</p>
          <Link href="/" className="inline-block mt-3 bg-primary-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
            Tembelea NyumbaFasta
          </Link>
        </div>
      </article>
    </>
  )
}
