'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n/context'

export function ConfirmAgreementButton({ agreementId, orgId }: { agreementId: string; orgId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()

  async function handleConfirm() {
    if (!window.confirm('Thibitisha makubaliano haya kama yaliyokubaliwa?')) return
    setConfirming(true)
    try {
      const res = await fetch(
        `/api/v1/organizations/${orgId}/agreements?agreementId=${agreementId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        }
      )
      if (res.ok) {
        setDone(true)
        router.refresh()
      }
    } finally {
      setConfirming(false)
    }
  }

  if (done) {
    return (
      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
        <i className="ti ti-circle-check" /> {t('pr_confirm_agree_ok')}
      </span>
    )
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={confirming}
      className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50"
    >
      {confirming ? t('pr_confirm_agree_confirming') : t('pr_confirm_agree_btn')}
    </button>
  )
}
