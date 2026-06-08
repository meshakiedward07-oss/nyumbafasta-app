import dynamic from 'next/dynamic'

const ChatMonitorClient = dynamic(() => import('./ChatMonitorClient'), { ssr: false })

export default function ChatMonitorPage() {
  return <ChatMonitorClient />
}
