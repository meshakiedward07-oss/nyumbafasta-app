import dynamic from 'next/dynamic'

const LeadsClient = dynamic(
  () => import('./LeadsClient'),
  { ssr: false }
)

export default function LeadsPage() {
  return <LeadsClient />
}
