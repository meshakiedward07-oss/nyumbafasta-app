import dynamic from 'next/dynamic'
const TemplatesClient = dynamic(() => import('./TemplatesClient'), { ssr: false })
export default function TemplatesPage() { return <TemplatesClient /> }
