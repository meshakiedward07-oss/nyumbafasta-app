'use client'
import dynamic from 'next/dynamic'

const EmailClient = dynamic(() => import('./EmailClient'), { ssr: false })

export default function EmailLoader({ senderName }: { senderName: string }) {
  return <EmailClient senderName={senderName} />
}
