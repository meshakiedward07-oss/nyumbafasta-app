import dynamic from 'next/dynamic'

export const metadata = { title: 'Hesabu — NyumbaFasta Admin' }

const AccountingClient = dynamic(
  () => import('./AccountingClient'),
  { ssr: false }
)

export default function AccountingPage() {
  return <AccountingClient />
}
