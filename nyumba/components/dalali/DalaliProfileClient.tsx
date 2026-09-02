'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Avatar from '@/components/shared/Avatar'
import DeleteAccountModal from '@/components/dalali/DeleteAccountModal'
import { useLanguage } from '@/lib/i18n/context'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

async function uploadAvatar(file: File, tooBigMsg: string): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error(tooBigMsg)
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/upload/avatar', { method: 'POST', body: fd })
  const data = await res.json()
  if (!data.url) throw new Error(data.error ?? 'Upload ilishindwa')
  return data.url as string
}

type Props = {
  fullName: string
  phone: string | null
  whatsappNumber: string
  bio: string
  ratingAvg: number
  ratingCount: number
  isVerified: boolean
  avatarUrl?: string | null
  username?: string | null
}

export default function DalaliProfileClient({
  fullName, phone, whatsappNumber, bio, ratingAvg, ratingCount, isVerified, avatarUrl,
  username: initialUsername,
}: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName]         = useState(fullName)
  const [whatsapp, setWhatsapp] = useState(whatsappNumber.replace(/^\+?255/, ''))
  const [bioText, setBioText]   = useState(bio)
  const [avatar, setAvatar]     = useState<string | null>(avatarUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [username, setUsername]       = useState<string | null>(initialUsername ?? null)
  const [generatingUrl, setGeneratingUrl] = useState(false)
  const [copied, setCopied]           = useState(false)

  const profileUrl = username ? `${APP_URL}/agent/${username}` : null

  // Auto-generate username on first load if dalali doesn't have one
  useEffect(() => {
    if (initialUsername) return
    setGeneratingUrl(true)
    fetch('/api/v1/profile/username/auto-generate', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.username) setUsername(d.username) })
      .catch(() => null)
      .finally(() => setGeneratingUrl(false))
  }, [initialUsername])

  function copyLink() {
    if (!profileUrl) return
    navigator.clipboard.writeText(profileUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadAvatar(file, t('profile_photo_too_large'))
      setAvatar(url)
      // Save immediately
      await fetch('/api/v1/dalali/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      })
      setSuccess(t('profile_photo_saved'))
      setTimeout(() => setSuccess(''), 5000)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload ilishindwa')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !whatsapp.trim()) {
      setError(t('profile_name_wa_req'))
      return
    }
    // Validate: must be 9 digits after stripping 0/255 prefix (Tanzania numbers)
    const digits = whatsapp.replace(/\D/g, '').replace(/^(255|0)/, '')
    if (digits.length !== 9 || !/^\d{9}$/.test(digits)) {
      setError(t('profile_wa_invalid'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/v1/dalali/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          whatsapp_number: `255${whatsapp.replace(/^0/, '')}`,
          bio: bioText,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSuccess(t('profile_saved'))
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kuhifadhi')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 px-4 py-3">
        <button onClick={() => router.back()}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 active:scale-90 transition-transform">
          ←
        </button>
        <h1 className="text-sm font-bold text-gray-900 flex-1">{t('profile_my_profile')}</h1>
        {isVerified && (
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">
            <i className="ti ti-circle-check" aria-hidden="true" /> {t('profile_verified')}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="px-4 pt-5 space-y-4">

        {success && (
          <div className="bg-primary-50 border border-primary-100 text-primary-700 text-sm px-4 py-3 rounded-xl">
            <i className="ti ti-circle-check" aria-hidden="true" /> {success}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* ── Avatar upload ── */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar src={avatar} name={name || 'D'} size={88} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary-500 text-white rounded-full
                         flex items-center justify-center shadow-md text-sm
                         disabled:opacity-60 active:scale-95 transition-all"
              title="Badilisha picha"
            >
              {uploading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin block" />
              ) : <i className="ti ti-camera" aria-hidden="true" />}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {uploading ? t('qe_uploading') : t('profile_tap_change')}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarPick}
          />
        </div>

        {/* Rating */}
        {ratingCount > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-gray-900">{ratingAvg.toFixed(1)}</p>
            <div className="flex justify-center gap-0.5 my-1">
              {[1,2,3,4,5].map(i => (
                <i key={i} className={`ti ti-star-filled text-lg ${i <= Math.round(ratingAvg) ? 'text-amber-400' : 'text-gray-200'}`} aria-hidden="true" />
              ))}
            </div>
            <p className="text-xs text-gray-400">{ratingCount} {t('dash_reviews_from')}</p>
          </div>
        )}

        {/* ── Profile URL card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <i className="ti ti-link text-primary-500" aria-hidden="true" />
            {t('profile_link_title')}
          </p>

          {generatingUrl ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin block flex-shrink-0" />
              {t('profile_gen_link')}
            </div>
          ) : profileUrl ? (
            <div className="space-y-3">
              {/* URL display */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
                <span className="text-xs text-primary-600 font-medium flex-1 truncate">
                  {APP_URL}/agent/<span className="font-bold">{username}</span>
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                             bg-primary-500 text-white font-medium active:scale-95 transition-all"
                >
                  <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} aria-hidden="true" />
                  {copied ? t('profile_copied') : t('profile_copy')}
                </button>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2">
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl
                             border border-primary-200 text-primary-600 hover:bg-primary-50 transition-all"
                >
                  <i className="ti ti-external-link" aria-hidden="true" />
                  {t('profile_view_page')}
                </a>
                <a
                  href="/dashboard/profile/username"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl
                             border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <i className="ti ti-edit" aria-hidden="true" />
                  {t('profile_change_username')}
                </a>
              </div>

              {/* QR Code */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                  <img
                    src={`/api/v1/profile/qr?u=${username}`}
                    alt="QR Code ya profile yako"
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    <i className="ti ti-qrcode text-primary-500 mr-1" aria-hidden="true" />
                    {t('profile_qr_title')}
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed mb-2">
                    {t('profile_qr_desc')}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`/api/v1/profile/qr?u=${username}`}
                      download={`nyumbafasta-${username}-qr.png`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-white bg-primary-500
                                 px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                    >
                      <i className="ti ti-download" aria-hidden="true" />
                      {t('common_download')}
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Angalia listings zangu za nyumba kwenye NyumbaFasta:\n${profileUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] font-medium text-gray-700 border border-gray-300
                                 bg-white px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
                    >
                      <i className="ti ti-brand-whatsapp text-green-600" aria-hidden="true" />
                      {t('common_share')}
                    </a>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                {t('profile_link_hint')}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">{t('profile_link_failed')}</p>
          )}
        </div>

        {/* Editable fields */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              {t('profile_full_name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text" required value={name}
              onChange={e => setName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              {t('profile_contact_num')} <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                +255
              </div>
              <input
                type="tel" inputMode="numeric" required
                placeholder="712 345 678"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
            {whatsapp.replace(/\D/g, '').length >= 9 && (
              <p className="text-xs text-primary-600 mt-1 font-medium">
                {t('profile_wa_saved_as')} +255{whatsapp.replace(/\D/g, '').replace(/^0/, '')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">{t('profile_wa_hint')}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              {t('profile_bio_label')}
            </label>
            <textarea
              rows={3}
              placeholder={t('profile_bio_placeholder')}
              value={bioText}
              onChange={e => setBioText(e.target.value)}
              maxLength={300}
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{bioText.length}/300</p>
          </div>
        </div>

        {phone && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('profile_contact_section')}</p>
            <p className="text-xs text-gray-400">{t('profile_phone')}</p>
            <p className="text-sm text-gray-700">{phone}</p>
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold
                     disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {saving ? t('qe_saving') : t('qe_save_btn')}
        </button>
      </form>

      {/* ── Rufaa ya Marafiki teaser — the referral page (app/(dalali)/dashboard/
          referral) had no navigation link pointing to it anywhere in the app;
          it was only reachable by typing the URL directly. Found 2026-09-02. ── */}
      <Link
        href="/dashboard/referral"
        className="mx-4 flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4 active:scale-[0.98] transition-all"
      >
        <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <i className="ti ti-users-plus text-primary-600 text-xl" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">{t('ref_title')}</p>
          <p className="text-xs text-gray-400">{t('ref_subtitle')}</p>
        </div>
        <i className="ti ti-chevron-right text-gray-300 flex-shrink-0" aria-hidden="true" />
      </Link>

      {/* ── Danger Zone ── */}
      <div className="mx-4 bg-white rounded-2xl border border-red-100 shadow-sm p-4 mt-4 mb-6">
        <h3 className="text-sm font-bold text-red-600 mb-1 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />{t('profile_danger_zone')}</h3>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          {t('profile_danger_desc')}
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-medium
                     hover:bg-red-50 active:scale-[0.97] transition-all"
        >
          <i className="ti ti-trash" aria-hidden="true" /> {t('profile_delete_btn')}
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  )
}
