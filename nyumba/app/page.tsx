import dynamic from 'next/dynamic'
import RegionLinks from '@/components/seo/RegionLinks'

const HomeClient = dynamic(
  () => import('@/components/home/HomeClient'),
  { ssr: false }
)

export default function Page() {
  return (
    <>
      <HomeClient />
      {/* Server-rendered SEO region links — crawlable internal links */}
      <div className="pb-24">
        <RegionLinks />
      </div>
    </>
  )
}
