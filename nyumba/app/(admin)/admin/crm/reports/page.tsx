import dynamic from 'next/dynamic'
const ReportsClient = dynamic(() => import('./ReportsClient'), { ssr: false })
export default function ReportsPage() { return <ReportsClient /> }
