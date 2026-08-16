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

const LanguagePicker = dynamic(
  () => import('@/components/LanguagePicker'),
  { ssr: false }
)

const FraudTracker = dynamic(
  () => import('@/components/fraud/FraudTracker'),
  { ssr: false }
)

// ForceInstallGate must be first: it's the blocking post-signup gate (z-[999]).
// InstallPrompt is the passive suggestion for users who haven't signed up recently.
const ForceInstallGate = dynamic(
  () => import('@/components/shared/ForceInstallGate'),
  { ssr: false }
)

const InstallPrompt = dynamic(
  () => import('@/components/shared/InstallPrompt'),
  { ssr: false }
)

export default function ClientProviders() {
  return (
    <>
      <ForceInstallGate />
      <LanguagePicker />
      <WhatsAppSupportButton />
      <PushSetup />
      <InstallPrompt />
      <FraudTracker />
    </>
  )
}
