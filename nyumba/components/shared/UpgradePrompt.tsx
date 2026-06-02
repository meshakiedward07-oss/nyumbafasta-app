'use client'
import Link from 'next/link'
import { getPlan, type PlanType } from '@/lib/config/subscription-plans'

type Props = {
  feature: string
  requiredPlan: PlanType
}

export default function UpgradePrompt({ feature, requiredPlan }: Props) {
  const plan = getPlan(requiredPlan)

  return (
    <div className="text-center py-8 px-4">
      <div className="text-4xl mb-3">{plan.emoji}</div>
      <p className="font-bold text-gray-800 mb-1">
        {feature} inahitaji {plan.name}
      </p>
      <p className="text-gray-500 text-sm mb-4">
        Upgrade kwenda {plan.name} kwa Tsh {plan.price.toLocaleString()}/mwezi
      </p>
      <Link href="/dashboard/subscription">
        <button
          className="px-6 py-3 rounded-xl text-white font-semibold active:scale-95 transition-transform"
          style={{ backgroundColor: plan.color }}
        >
          Upgrade Sasa →
        </button>
      </Link>
    </div>
  )
}
