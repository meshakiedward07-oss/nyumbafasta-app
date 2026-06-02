import { redirect } from 'next/navigation'

// Redirect to the main subscription page under dashboard
export default async function SubscriptionPage() {
  redirect('/dashboard/subscription')
}
