import dynamic from 'next/dynamic'
const CommissionClient = dynamic(() => import('./CommissionClient'), { ssr: false })
export default function CommissionPage() { return <CommissionClient /> }
