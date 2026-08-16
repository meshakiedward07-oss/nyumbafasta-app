'use client'
import dynamic from 'next/dynamic'

const WhatsAppPanel = dynamic(() => import('./WhatsAppPanel'), { ssr: false })

export default function WhatsAppLoader() {
  return <WhatsAppPanel />
}
