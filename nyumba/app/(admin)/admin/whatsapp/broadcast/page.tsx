import dynamic from 'next/dynamic'

const BroadcastClient = dynamic(() => import('./BroadcastClient'), { ssr: false })

export default function BroadcastPage() {
  return <BroadcastClient />
}
