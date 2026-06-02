'use client'
import dynamic from 'next/dynamic'

// These components are browser-only — load them client-side after hydration
const WhatsAppSupportButton = dynamic(
  () => import('@/components/shared/WhatsAppSupportButton'),
  { ssr: false }
)

const PushSetup = dynamic(
  () => import('@/components/shared/PushSetup'),
  { ssr: false }
)

export default function ClientProviders() {
  return (
    <>
      <WhatsAppSupportButton />
      <PushSetup />
    </>
  )
}
