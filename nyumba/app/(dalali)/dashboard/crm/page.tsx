import dynamic from 'next/dynamic'
const DalaliCRMClient = dynamic(() => import('./DalaliCRMClient'), { ssr: false })
export default function DalaliCRMPage() { return <DalaliCRMClient /> }
