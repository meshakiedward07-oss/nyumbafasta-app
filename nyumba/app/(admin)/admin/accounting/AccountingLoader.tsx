'use client'
import dynamic from 'next/dynamic'

const AccountingClient = dynamic(() => import('./AccountingClient'), { ssr: false })

export default function AccountingLoader() {
  return <AccountingClient />
}
