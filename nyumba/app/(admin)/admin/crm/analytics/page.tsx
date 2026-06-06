import dynamic from 'next/dynamic'
const AnalyticsClient = dynamic(() => import('./AnalyticsClient'), { ssr: false })
export default function AnalyticsPage() { return <AnalyticsClient /> }
