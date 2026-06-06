import dynamic from 'next/dynamic'

const CRMClient = dynamic(
  () => import('./CRMClient'),
  { ssr: false }
)

export default function CRMPage() {
  return <CRMClient />
}
