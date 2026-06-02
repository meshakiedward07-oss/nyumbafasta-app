'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

type Props = {
  currentStatus: string
  rejectionReason: string | null
  hasWhatsapp: boolean
}

async function uploadDoc(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', 'nyumba_profiles')
  fd.append('folder', 'nyumba/verifications')
  const res = await fetch('https://api.cloudinary.com/v1_1/daw8jlbbd/image/upload', {
    method: 'POST', body: fd,
  })
  const data = await res.json()
  if (!data.secure_url) throw new Error(data.error?.message ?? 'Upload ilishindwa')
  return data.secure_url as string
}

function StepBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5 px-4 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
          i < step ? 'bg-primary-500' : i === step ? 'bg-primary-300' : 'bg-gray-200'
        }`} />
      ))}
    </div>
  )
}

function UploadBox({
  label, value, onPick, loading,
}: { label: string; value: string | null; onPick: () => void; loading: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      {value ? (
        <div className="relative rounded-2xl overflow-hidden bg-gray-100 aspect-video">
          <Image fill src={value} alt={label} className="object-cover" unoptimized sizes="400px" />
          <button
            type="button"
            onClick={onPick}
            className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-sm font-medium"
          >
            Badilisha
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={loading}
          className="w-full aspect-video border-2 border-dashed border-gray-200 rounded-2xl
                     flex flex-col items-center justify-center gap-2 text-gray-400
                     disabled:opacity-50 active:scale-95 transition-all bg-gray-50"
        >
          {loading ? (
            <span className="w-7 h-7 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-3xl">📷</span>
              <span className="text-xs">Bonyeza kupakia picha</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

export default function VerifyWizard({ currentStatus, rejectionReason, hasWhatsapp }: Props) {
  const router = useRouter()

  const [step, setStep]             = useState(0)
  const [nida, setNida]             = useState('')
  const [whatsapp, setWhatsapp]     = useState('')
  const [front, setFront]           = useState<string | null>(null)
  const [back, setBack]             = useState<string | null>(null)
  const [selfie, setSelfie]         = useState<string | null>(null)
  const [uploading, setUploading]   = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)

  // Steps: 0=NIDA, [1=WhatsApp if needed], last-2=front, last-1=back, last=selfie
  const steps = hasWhatsapp
    ? ['Nambari ya NIDA', 'Kitambulisho (Mbele)', 'Kitambulisho (Nyuma)', 'Selfie']
    : ['Nambari ya NIDA', 'Nambari ya WhatsApp', 'Kitambulisho (Mbele)', 'Kitambulisho (Nyuma)', 'Selfie']

  const totalSteps = steps.length

  // Map logical step index to content
  const stepContent = hasWhatsapp
    ? ['nida', 'front', 'back', 'selfie']
    : ['nida', 'whatsapp', 'front', 'back', 'selfie']

  const currentContent = stepContent[step]

  const frontRef  = useRef<HTMLInputElement>(null)
  const backRef   = useRef<HTMLInputElement>(null)
  const selfieRef = useRef<HTMLInputElement>(null)

  async function handleFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    key: string
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Picha ni kubwa sana (max 5MB)'); return }
    setUploading(key)
    setError('')
    try {
      const url = await uploadDoc(file)
      setter(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload ilishindwa')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/v1/dalali/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nida_number: nida,
          nida_image_front: front,
          nida_image_back: back,
          selfie_image: selfie,
          whatsapp_number: hasWhatsapp ? undefined : `255${whatsapp.replace(/^0/, '')}`,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Imeshindwa kutuma')
    } finally {
      setSubmitting(false)
    }
  }

  // Already submitted states
  if (currentStatus === 'pending' && !done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <div className="text-5xl mb-3">⏳</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Inakaguliwa</h2>
          <p className="text-sm text-gray-500">Hati zako zinakaguliwa na admin — kawaida masaa 24.</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            Rudi Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (currentStatus === 'verified') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <div className="text-5xl mb-3">✅</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Umeshathibitishwa!</h2>
          <p className="text-sm text-gray-500">Akaunti yako ina badge ya Verified.</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            Rudi Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Imetumwa!</h2>
          <p className="text-sm text-gray-500">Hati zako zimetumwa. Utapata jibu ndani ya masaa 24.</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            Rudi Dashboard
          </button>
        </div>
      </div>
    )
  }

  const canNextMap: Record<string, boolean> = {
    nida:     nida.trim().length >= 8,
    whatsapp: whatsapp.replace(/\D/g, '').length >= 9,
    front:    !!front,
    back:     !!back,
    selfie:   !!selfie,
  }
  const canNext = canNextMap[currentContent] ?? false
  const isLastStep = step === totalSteps - 1

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">Thibitisha Utambulisho</h1>
            <p className="text-xs text-gray-400">Hatua {step + 1} ya {totalSteps} — {steps[step]}</p>
          </div>
        </div>
        <StepBar step={step} total={totalSteps} />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {currentStatus === 'rejected' && rejectionReason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            ❌ Ombi lako la awali lilikataliwa. Sababu: <strong>{rejectionReason}</strong>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* STEP: NIDA number */}
        {currentContent === 'nida' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-xs text-primary-700">
              🔒 Taarifa zako za utambulisho zinashughulikiwa kwa usalama na usiri.
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Nambari ya NIDA <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="mfano: 19960123456789000001"
              value={nida}
              onChange={e => setNida(e.target.value.replace(/\D/g, ''))}
              maxLength={20}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base
                         focus:outline-none focus:ring-2 focus:ring-primary-300 tracking-widest"
            />
            <p className="text-xs text-gray-400">Nambari yako ya NIDA ina tarakimu 20.</p>
          </div>
        )}

        {/* STEP: WhatsApp (only when no existing whatsapp) */}
        {currentContent === 'whatsapp' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              ⚠️ Unahitaji nambari ya WhatsApp kwa verification. Wateja watalipa Tsh 2,000 kupata nambari hii.
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Nambari ya WhatsApp <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                🇹🇿 +255
              </div>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="712 345 678"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base
                           focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          </div>
        )}

        {/* STEP: Front of ID */}
        {currentContent === 'front' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <input ref={frontRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFilePick(e, setFront, 'front')} />
            <UploadBox
              label="Upande wa Mbele wa Kitambulisho (NIDA / Passport)"
              value={front}
              onPick={() => frontRef.current?.click()}
              loading={uploading === 'front'}
            />
            <p className="text-xs text-gray-400 mt-2">Hakikisha maandishi yanaonekana wazi.</p>
          </div>
        )}

        {/* STEP: Back of ID */}
        {currentContent === 'back' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <input ref={backRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFilePick(e, setBack, 'back')} />
            <UploadBox
              label="Upande wa Nyuma wa Kitambulisho"
              value={back}
              onPick={() => backRef.current?.click()}
              loading={uploading === 'back'}
            />
          </div>
        )}

        {/* STEP: Selfie */}
        {currentContent === 'selfie' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden"
              onChange={e => handleFilePick(e, setSelfie, 'selfie')} />
            <UploadBox
              label="Selfie — Piga picha ukishikilia kitambulisho chako"
              value={selfie}
              onPick={() => selfieRef.current?.click()}
              loading={uploading === 'selfie'}
            />
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              💡 Piga picha ya uso wako ukishikilia kitambulisho — uso na picha ya kitambulisho zinaonekana wazi.
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
        {!isLastStep ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-40 active:scale-95 transition-all"
          >
            Endelea →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canNext || submitting}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-50 active:scale-95 transition-all"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Inatuma...
              </span>
            ) : '✅ Wasilisha kwa Ukaguzi'}
          </button>
        )}
      </div>
    </div>
  )
}
