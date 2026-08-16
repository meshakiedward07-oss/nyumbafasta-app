'use client'
import dynamic from 'next/dynamic'

const SocialDashboard = dynamic(() => import('./SocialDashboard'), { ssr: false })

export default function SocialLoader() {
  return <SocialDashboard />
}
