import dynamic from 'next/dynamic'

const WhatsAppPanel = dynamic(() => import('./WhatsAppPanel'), { ssr: false })

export default function AdminWhatsAppPage() {
  return <WhatsAppPanel />
}
