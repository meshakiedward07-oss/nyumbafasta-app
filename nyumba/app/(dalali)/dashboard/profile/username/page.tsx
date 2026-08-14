'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n/context'

export default function UsernamePage() {
  const { t } = useLanguage()
  const [username, setUsername]         = useState('')
  const [checking, setChecking]         = useState(false)
  const [available, setAvailable]       = useState<boolean | null>(null)
  const [saving, setSaving]             = useState(false)
  const [current, setCurrent]           = useState<string | null>(null)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [loading, setLoading]           = useState(true)
  const [verifiedGate, setVerifiedGate] = useState(false) // true = not yet verified

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    fetch('/api/v1/profile/username')
      .then(r => r.json())
      .then((d: { username?: string | null; error?: string }) => {
        if (d.error?.includes('idhibitiwa')) setVerifiedGate(true)
        else { setCurrent(d.username ?? null); setUsername(d.username ?? '') }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const checkAvailability = useCallback((val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setUsername(clean)
    setAvailable(null)

    if (clean === current) { setAvailable(null); return }
    if (clean.length < 3)  return

    setChecking(true)
    fetch(`/api/v1/profile/username/check?u=${clean}`)
      .then(r => r.json())
      .then((d: { available: boolean }) => setAvailable(d.available))
      .catch(() => setAvailable(null))
      .finally(() => setChecking(false))
  }, [current])

  async function handleSave() {
    if (username.length < 3) return
    if (available === false && username !== current) return

    setSaving(true)
    try {
      const res  = await fetch('/api/v1/profile/username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json() as { success?: boolean; error?: string; username?: string }

      if (!res.ok || data.error) {
        showToast(data.error ?? t('usr_save_error'), false)
      } else {
        setCurrent(data.username ?? username)
        setAvailable(null)
        showToast(t('usr_save_success'))
      }
    } finally {
      setSaving(false)
    }
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
  const profileUrl = current ? `${APP_URL}/agent/${current}` : null

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (verifiedGate) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
          <i className="ti ti-lock text-3xl text-amber-500 block mb-3" aria-hidden="true" />
          <h1 className="font-semibold text-gray-900 mb-2">{t('usr_gate_title')}</h1>
          <p className="text-sm text-gray-600 mb-4">{t('usr_gate_desc')}</p>
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-500 text-white text-sm font-semibold rounded-xl"
          >
            <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
            {t('usr_gate_btn')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm max-w-xs text-white ${toast.ok ? 'bg-gray-900' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <Link href="/dashboard/profile" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mb-3">
          <i className="ti ti-arrow-left text-xs" aria-hidden="true" /> {t('usr_back')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('usr_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('usr_subtitle')}</p>
      </div>

      {/* Current URL display */}
      {profileUrl && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
            <i className="ti ti-circle-check text-sm" aria-hidden="true" />
            {t('usr_current_link')}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm text-green-800 bg-white border border-green-200 rounded-xl px-3 py-2 truncate">
              {profileUrl}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(profileUrl).then(() => showToast(t('usr_link_copied')))}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 transition-colors"
            >
              <i className="ti ti-copy text-xs" aria-hidden="true" />
              {t('usr_copy_btn')}
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-green-700 font-medium hover:underline"
            >
              <i className="ti ti-external-link text-xs" aria-hidden="true" />
              {t('usr_view_profile')}
            </a>
          </div>

          {/* QR Code */}
          <div className="mt-4 pt-4 border-t border-green-200 flex items-center gap-4">
            <div className="w-28 h-28 rounded-xl overflow-hidden bg-white border border-green-200 flex-shrink-0 shadow-sm">
              <img
                src={`/api/v1/profile/qr?u=${current}`}
                alt="QR Code ya profile yako"
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-green-800 mb-1 flex items-center gap-1.5">
                <i className="ti ti-qrcode text-sm" aria-hidden="true" />
                {t('usr_qr_title')}
              </p>
              <p className="text-[11px] text-green-700 leading-relaxed mb-3">
                {t('usr_qr_desc')}
              </p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`/api/v1/profile/qr?u=${current}`}
                  download={`nyumbafasta-${current}-qr.png`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600
                             px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <i className="ti ti-download text-xs" aria-hidden="true" />
                  {t('usr_qr_download')}
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Angalia listings zangu za nyumba kwenye NyumbaFasta:\n${profileUrl}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-green-800 border border-green-300
                             bg-white px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <i className="ti ti-brand-whatsapp text-xs" aria-hidden="true" />
                  {t('usr_qr_share')}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Username input */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <label className="text-sm font-semibold text-gray-800 block mb-3">
          {current ? t('usr_input_change') : t('usr_input_choose')}
        </label>

        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-gray-400 transition-colors">
          <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap flex-shrink-0">
            nyumbafasta.co/agent/
          </span>
          <input
            type="text"
            value={username}
            onChange={e => checkAvailability(e.target.value)}
            placeholder="jina_lako"
            maxLength={30}
            className="flex-1 px-3 py-3 text-sm font-mono text-gray-900 outline-none bg-white min-w-0"
          />
          <div className="px-3 flex-shrink-0 w-8 flex items-center justify-center">
            {checking && <i className="ti ti-loader-2 animate-spin text-gray-400 text-base" aria-hidden="true" />}
            {!checking && available === true  && <i className="ti ti-check text-green-500 text-base" aria-hidden="true" />}
            {!checking && available === false && <i className="ti ti-x text-red-400 text-base" aria-hidden="true" />}
          </div>
        </div>

        {available === true  && username !== current && (
          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
            <i className="ti ti-check text-xs" aria-hidden="true" /> {t('usr_available').replace('{{name}}', username)}
          </p>
        )}
        {available === false && (
          <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
            <i className="ti ti-x text-xs" aria-hidden="true" /> {t('usr_taken').replace('{{name}}', username)}
          </p>
        )}

        <p className="text-xs text-gray-400 mt-3">
          {t('usr_format_hint')}
          {current && ` ${t('usr_change_hint')}`}
        </p>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || username.length < 3 || (available === false && username !== current)}
        className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
      >
        {saving
          ? <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" /> {t('usr_saving')}</>
          : <><i className="ti ti-check" aria-hidden="true" /> {t('usr_save_btn')}</>
        }
      </button>

    </div>
  )
}
