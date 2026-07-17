'use client'
import { useRouter, useParams } from 'next/navigation'
import UploadCreative from '@/components/ads/UploadCreative'
import Link from 'next/link'

export default function CampaignCreativePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Link
          href="/advertising/dashboard"
          className="text-sm text-gray-400 hover:text-gray-600 transition mb-3 inline-block"
        >
          ← Dashibodi
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Pakia Creative ya Tangazo</h1>
        <p className="text-gray-500 text-sm mt-1">
          Pakia picha au video — mfumo utatengeneza mifumo yote kiotomatiki.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <UploadCreative
          campaignId={id}
          onDone={() => router.push('/advertising/dashboard?creative=1')}
          onSkip={() => router.push('/advertising/dashboard')}
        />
      </div>

      {/* What gets generated */}
      <div className="mt-4 bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-semibold text-gray-700 mb-2">Mifumo inayoundwa kiotomatiki:</p>
        <ul className="space-y-1 text-xs text-gray-500">
          <li>🎯 <strong>Banner</strong> — 1200×400 (ukurasa mkuu)</li>
          <li>🔍 <strong>Search</strong> — 600×200 (matokeo ya utafutaji)</li>
          <li>📍 <strong>Nearby</strong> — 300×200 (biashara karibu)</li>
          <li>⭐ <strong>Featured</strong> — 800×450 (saraka ya biashara)</li>
          <li>🎬 <strong>Thumbnail</strong> — 640×360 (video au ukurasa wa dalali)</li>
        </ul>
      </div>
    </div>
  )
}
