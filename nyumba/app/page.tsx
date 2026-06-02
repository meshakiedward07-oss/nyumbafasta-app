import dynamic from 'next/dynamic'

const HomeClient = dynamic(
  () => import('@/components/home/HomeClient'),
  { ssr: false }
)

export default function Page() {
  return <HomeClient />
}
