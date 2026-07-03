'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/shared/Avatar'
import DeleteAccountModal from '@/components/dalali/DeleteAccountModal'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

async function uploadAvatar(file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error('Picha ni kubwa sana (max 2MB)')
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', 'nyumba_profiles')  // unsigned preset
  fd.append('folder', 'nyumba/profiles')
  const res = await fetch('https://api.cloudinary.com/v1_1/daw8jlbbd/image/upload', {
    method: 'POST',
    body: fd,
  })
  const data = await res.json()
  if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload ilishindwa')
  return data.secure_url as string
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
      const url = await uploadAvatar(file)
      setAvatar(url)
      // Save immediately
      await fetch('/api/v1/dalali/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: url }),
      })
      setSuccess('Picha imehifadhiwa!')
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
      setError('Jina na WhatsApp vinahitajika')
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
      setSuccess('Wasifu umehifadhiwa!')
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
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
          ←
        </button>
        <h1 className="text-sm font-bold text-gray-900 flex-1">Wasifu Wangu</h1>
        {isVerified && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            <i className="ti ti-circle-check" aria-hidden="true" /> Premium
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
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full
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
            {uploading ? 'Inapakia...' : 'Bonyeza kubadilisha picha'}
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
            <p className="text-xs text-gray-400">{ratingCount} maoni kutoka kwa wateja</p>
          </div>
        )}

        {/* ── Profile URL card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <i className="ti ti-link text-primary-500" aria-hidden="true" />
            Kiungo cha Wasifu Wako
          </p>

          {generatingUrl ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin block flex-shrink-0" />
              Inaunda kiungo chako...
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
                  {copied ? 'Imenakiliwa!' : 'Nakili'}
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
                  Angalia Ukurasa Wako
                </a>
                <a
                  href="/dashboard/profile/username"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl
                             border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  <i className="ti ti-edit" aria-hidden="true" />
                  Badilisha Username
                </a>
              </div>

              <p className="text-[10px] text-gray-400 leading-relaxed">
                Shiriki kiungo hiki kwa wateja — wataona listings zako zote na wasiliana nawe.
                Username inaweza kubadilishwa mara moja kila siku 30.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Kiungo hakikuweza kuundwa — jaribu upya.</p>
          )}
        </div>

        {/* Editable fields */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Jina Kamili <span className="text-red-400">*</span>
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
              Namba ya Mawasiliano <span className="text-red-400">*</span>
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
                Nambari itahifadhiwa kama: +255{whatsapp.replace(/\D/g, '').replace(/^0/, '')}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Wateja watalipa Tsh 2,000 kupata nambari hii — itatumika kwa WhatsApp na Simu</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Kuhusu Mimi (Bio)
            </label>
            <textarea
              rows={3}
              placeholder="Elezea uzoefu wako, maeneo unayofanya kazi, n.k..."
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mawasiliano</p>
            <p className="text-xs text-gray-400">Simu</p>
            <p className="text-sm text-gray-700">{phone}</p>
          </div>
        )}

        <button
          type="submit" disabled={saving}
          className="w-full bg-primary-500 text-white py-3.5 min-h-[48px] rounded-2xl text-sm font-semibold
                     disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {saving ? 'Inahifadhi...' : 'Hifadhi Mabadiliko'}
        </button>
      </form>

      {/* ── Danger Zone ── */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 mt-4">
        <h3 className="text-sm font-bold text-red-600 mb-1 flex items-center gap-1"><i className="ti ti-alert-triangle" aria-hidden="true" />Hatua za Hatari</h3>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
          Ukifuta akaunti — listings, subscription na data yako yote itafutwa kabisa na haiwezi kurejeshwa.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="text-red-600 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-medium
                     hover:bg-red-50 active:scale-[0.97] transition-all"
        >
          <i className="ti ti-trash" aria-hidden="true" /> Futa Akaunti Yangu
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  )
}
