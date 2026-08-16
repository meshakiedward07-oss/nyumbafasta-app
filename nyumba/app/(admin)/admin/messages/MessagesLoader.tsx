'use client'
import dynamic from 'next/dynamic'

const MessagesPanel = dynamic(() => import('./MessagesPanel'), { ssr: false })

export default function MessagesLoader(props: {
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
}) {
  return <MessagesPanel {...props} />
}
