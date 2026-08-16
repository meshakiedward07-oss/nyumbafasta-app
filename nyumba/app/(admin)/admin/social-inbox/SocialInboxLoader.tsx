'use client'
import dynamic from 'next/dynamic'

const SocialInboxPanel = dynamic(() => import('./SocialInboxPanel'), { ssr: false })

export default function SocialInboxLoader() {
  return <SocialInboxPanel />
}
