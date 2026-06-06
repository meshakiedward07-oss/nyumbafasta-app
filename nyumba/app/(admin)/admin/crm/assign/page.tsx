import dynamic from 'next/dynamic'
const AssignClient = dynamic(() => import('./AssignClient'), { ssr: false })
export default function AssignPage() { return <AssignClient /> }
