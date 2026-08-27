'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '@/lib/i18n/context'

// Verification is a 3-5 step wizard that requires taking photos with the
// phone camera (capture="environment"/"user" file inputs). Each photo step
// backgrounds the browser tab while the native camera app is open — on
// memory-constrained Android phones (the norm for this user base) the OS
// can reclaim the tab mid-flow, silently reloading the page. Without this,
// all wizard progress (already-uploaded photo URLs included) was lost and
// the dalali had to start over from the NIDA-number step, which presented
// as "the app just quits" partway through. Persisting to localStorage lets
// the wizard resume exactly where it left off after such a reload.
const DRAFT_KEY = 'nf_verify_draft'

type VerifyDraft = {
  step: number
  nida: string
  whatsapp: string
  front: string | null
  back: string | null
  selfie: string | null
  licenseUrl: string | null
  licenseName: string | null
}

function loadDraft(skip = false): VerifyDraft | null {
  if (typeof window === 'undefined' || skip) return null
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) as VerifyDraft : null
  } catch { return null }
}

function saveDraft(draft: VerifyDraft) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch { /* ignore */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
}

type Props = {
  currentStatus: string
  rejectionReason: string | null
  hasWhatsapp: boolean
}

// Downscale camera photos client-side before upload. Modern phone cameras
// capture at 4000x3000px+ (several MB, sometimes 15-30MB raw) — decoding
// that at full resolution is exactly what triggers "unable to complete
// operation due to low memory" on RAM-constrained Android devices and
// in-app browsers (WhatsApp/Facebook/Instagram webviews have much tighter
// memory caps than a full browser tab). createImageBitmap() decodes more
// memory-efficiently than the old new Image()+canvas approach. Any failure
// here (unsupported format, or the device running out of memory on the
// resize itself) silently falls back to the original file — never worse
// than before this existed.
async function resizeImageFile(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  if (file.size < 800 * 1024) return file // already small enough
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    if (scale >= 1) { bitmap.close?.(); return file }
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return file }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

// 60s timeout so a slow/dropped mobile connection surfaces a clear error
// instead of leaving the upload button spinning indefinitely.
async function uploadDoc(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd, signal: AbortSignal.timeout(60_000) })
  const data = await res.json()
  if (!data.url) throw new Error(data.error ?? 'Upload ilishindwa')
  return data.url as string
}

async function uploadPdf(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/upload/document', { method: 'POST', body: fd, signal: AbortSignal.timeout(60_000) })
  const data = await res.json()
  if (!data.url) throw new Error(data.error ?? 'Upload ilishindwa')
  return data.url as string
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
  label, value, onPick, loading, error,
}: { label: string; value: string | null; onPick: () => void; loading: boolean; error?: string }) {
  const { t } = useLanguage()
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
            {t('verify_change_photo')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          disabled={loading}
          className={`w-full aspect-video border-2 border-dashed rounded-2xl
                     flex flex-col items-center justify-center gap-2 text-gray-400
                     disabled:opacity-50 active:scale-95 transition-all bg-gray-50 ${
                       error ? 'border-red-300' : 'border-gray-200'
                     }`}
        >
          {loading ? (
            <span className="w-7 h-7 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <i className="ti ti-camera text-3xl" aria-hidden="true" />
              <span className="text-xs">{t('verify_tap_upload')}</span>
            </>
          )}
        </button>
      )}
      {error && (
        <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
          <i className="ti ti-alert-triangle" aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  )
}

export default function VerifyWizard({ currentStatus, rejectionReason, hasWhatsapp }: Props) {
  const { t } = useLanguage()
  const router = useRouter()

  // Don't resume a draft across a rejection — the old (rejected) photos
  // shouldn't be silently resubmitted; a rejected dalali should start clean.
  const skipDraft = currentStatus === 'rejected'
  const [step, setStep]               = useState(() => loadDraft(skipDraft)?.step ?? 0)
  const [nida, setNida]               = useState(() => loadDraft(skipDraft)?.nida ?? '')
  const [whatsapp, setWhatsapp]       = useState(() => loadDraft(skipDraft)?.whatsapp ?? '')
  const [front, setFront]             = useState<string | null>(() => loadDraft(skipDraft)?.front ?? null)
  const [back, setBack]               = useState<string | null>(() => loadDraft(skipDraft)?.back ?? null)
  const [selfie, setSelfie]           = useState<string | null>(() => loadDraft(skipDraft)?.selfie ?? null)
  const [licenseUrl, setLicenseUrl]   = useState<string | null>(() => loadDraft(skipDraft)?.licenseUrl ?? null)
  const [licenseName, setLicenseName] = useState<string | null>(() => loadDraft(skipDraft)?.licenseName ?? null)
  const [uploading, setUploading]     = useState<string | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [done, setDone]               = useState(false)

  // Persist progress after every change — including already-uploaded photo
  // URLs — so a tab reload triggered by the camera app resumes instead of
  // discarding everything back to step 0.
  useEffect(() => {
    saveDraft({ step, nida, whatsapp, front, back, selfie, licenseUrl, licenseName })
  }, [step, nida, whatsapp, front, back, selfie, licenseUrl, licenseName])

  // Steps: 0=NIDA, [1=WhatsApp if needed], last-2=front, last-1=back, last=selfie+license
  const steps = hasWhatsapp
    ? [t('verify_step_nida'), t('verify_step_front'), t('verify_step_back'), t('verify_step_selfie')]
    : [t('verify_step_nida'), t('verify_step_wa'), t('verify_step_front'), t('verify_step_back'), t('verify_step_selfie')]

  const totalSteps = steps.length

  const stepContent = hasWhatsapp
    ? ['nida', 'front', 'back', 'selfie']
    : ['nida', 'whatsapp', 'front', 'back', 'selfie']

  const currentContent = stepContent[step]

  const frontRef   = useRef<HTMLInputElement>(null)
  const backRef    = useRef<HTMLInputElement>(null)
  const selfieRef  = useRef<HTMLInputElement>(null)
  const licenseRef = useRef<HTMLInputElement>(null)

  async function handleFilePick(
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void,
    key: string
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError(t('verify_photo_large')); return }
    setUploading(key)
    setError('')
    try {
      const resized = await resizeImageFile(file)
      const url = await uploadDoc(resized)
      setter(url)
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      setError(isTimeout ? t('boost_timeout') : err instanceof Error ? err.message : 'Upload ilishindwa')
    } finally {
      setUploading(null)
      e.target.value = ''
    }
  }

  async function handleLicensePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError(t('verify_pdf_large')); return }
    setUploading('license')
    setError('')
    try {
      const url = await uploadPdf(file)
      setLicenseUrl(url)
      setLicenseName(file.name)
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === 'TimeoutError'
      setError(isTimeout ? t('boost_timeout') : err instanceof Error ? err.message : t('verify_license_fail'))
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
          business_license_url: licenseUrl ?? undefined,
          whatsapp_number: hasWhatsapp ? undefined : `255${whatsapp.replace(/^0/, '')}`,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      clearDraft()
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('verify_reviewing')}</h2>
          <p className="text-sm text-gray-500">{t('verify_reviewing_sub')}</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            {t('verify_back_dash')}
          </button>
        </div>
      </div>
    )
  }

  if (currentStatus === 'approved' || currentStatus === 'verified') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-circle-check text-primary-500" aria-hidden="true" /></div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('verify_verified_title')}</h2>
          <p className="text-sm text-gray-500">{t('verify_verified_sub')}</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            {t('verify_back_dash')}
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <div className="text-5xl mb-3 flex justify-center"><i className="ti ti-confetti text-primary-500" aria-hidden="true" /></div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{t('verify_sent_title')}</h2>
          <p className="text-sm text-gray-500">
            {t('verify_sent_sub')}
            {licenseUrl && (
              <> {t('verify_license_incl')} <strong>Dalali Halisi ✦</strong>.</>
            )}
          </p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-5 w-full bg-primary-500 text-white py-3 rounded-2xl text-sm font-semibold">
            {t('verify_back_dash')}
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
    <div className="min-h-screen bg-gray-50 pb-36 lg:pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => step === 0 ? router.back() : setStep(s => s - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
            ←
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-gray-900">{t('verify_title')}</h1>
            <p className="text-xs text-gray-400">{t('verify_step_n_of').replace('{{n}}', String(step + 1))} {totalSteps} — {steps[step]}</p>
          </div>
        </div>
        <StepBar step={step} total={totalSteps} />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {currentStatus === 'rejected' && rejectionReason && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
            <i className="ti ti-circle-x" aria-hidden="true" /> {t('verify_rejected')} <strong>{rejectionReason}</strong>
          </div>
        )}

        {error && !['front', 'back', 'selfie'].includes(currentContent) && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* STEP: NIDA number */}
        {currentContent === 'nida' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
              <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                <i className="ti ti-clipboard-list" aria-hidden="true" /> {t('verify_id_intro')}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">{t('verify_id_intro_sub')}</p>
            </div>
            <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-xs text-primary-700">
              <i className="ti ti-lock" aria-hidden="true" /> {t('verify_nida_privacy')}
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              {t('verify_nida_label')} <span className="text-red-400">*</span>
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
            <p className="text-xs text-gray-400">{t('verify_nida_hint')}</p>
          </div>
        )}

        {/* STEP: WhatsApp (only when no existing whatsapp) */}
        {currentContent === 'whatsapp' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              <i className="ti ti-alert-triangle" aria-hidden="true" /> {t('verify_wa_notice')}
            </div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              {t('verify_wa_label')} <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm text-gray-500 flex-shrink-0">
                +255
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
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 mb-3">
              <p className="text-xs text-blue-700 font-medium flex items-center gap-1"><i className="ti ti-clipboard-list" aria-hidden="true" />{t('verify_id_accepted')}</p>
              <p className="text-xs text-blue-600 mt-0.5">{t('verify_id_accepted_sub')}</p>
            </div>
            <UploadBox
              label={t('verify_front_label')}
              value={front}
              onPick={() => frontRef.current?.click()}
              loading={uploading === 'front'}
              error={error || undefined}
            />
            <p className="text-xs text-gray-400 mt-2">{t('verify_ensure_clear')}</p>
          </div>
        )}

        {/* STEP: Back of ID */}
        {currentContent === 'back' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <input ref={backRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFilePick(e, setBack, 'back')} />
            <UploadBox
              label={t('verify_back_label')}
              value={back}
              onPick={() => backRef.current?.click()}
              loading={uploading === 'back'}
              error={error || undefined}
            />
          </div>
        )}

        {/* STEP: Selfie + optional business license */}
        {currentContent === 'selfie' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden"
                onChange={e => handleFilePick(e, setSelfie, 'selfie')} />
              <UploadBox
                label={t('verify_selfie_label')}
                value={selfie}
                onPick={() => selfieRef.current?.click()}
                loading={uploading === 'selfie'}
                error={error || undefined}
              />
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                <i className="ti ti-bulb" aria-hidden="true" /> {t('verify_selfie_hint')}
              </div>
            </div>

            {/* Optional business license upload */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t('verify_license_title')}</p>
                  <p className="text-xs text-gray-400">{t('verify_license_opt')} <span className="text-amber-600 font-semibold">Dalali Halisi ✦</span></p>
                </div>
                <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  {t('verify_optional_badge')}
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <i className="ti ti-rosette-discount-check" aria-hidden="true" /> {t('verify_license_bens')}
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-amber-600">
                  <li>{t('verify_license_ben1')}</li>
                  <li>{t('verify_license_ben2')}</li>
                  <li>{t('verify_license_ben3')}</li>
                </ul>
              </div>

              <input
                ref={licenseRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleLicensePick}
              />

              {licenseUrl ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <i className="ti ti-file-type-pdf text-red-500 text-xl flex-shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{licenseName}</p>
                      <p className="text-[10px] text-green-600">{t('verify_uploaded')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLicenseUrl(null); setLicenseName(null) }}
                    className="text-xs text-gray-400 hover:text-red-400 flex-shrink-0 ml-2"
                  >
                    {t('verify_remove')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => licenseRef.current?.click()}
                  disabled={uploading === 'license'}
                  className="w-full border-2 border-dashed border-amber-200 bg-amber-50 rounded-xl
                             py-4 flex flex-col items-center gap-1.5 text-amber-700
                             disabled:opacity-50 active:scale-95 transition-all"
                >
                  {uploading === 'license' ? (
                    <span className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <i className="ti ti-file-type-pdf text-2xl" aria-hidden="true" />
                      <span className="text-xs font-medium">{t('verify_upload_license')}</span>
                      <span className="text-[10px] text-amber-500">{t('verify_max_10mb')}</span>
                    </>
                  )}
                </button>
              )}

              {error && uploading === null && licenseUrl === null && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <i className="ti ti-alert-triangle" aria-hidden="true" /> {error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CTA — sits above DalaliBottomNav (z-40, ~64px tall on mobile) */}
      <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 px-4 pt-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {!isLastStep ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            className="w-full bg-primary-500 text-white py-3.5 rounded-2xl text-sm font-semibold
                       disabled:opacity-40 active:scale-95 transition-all"
          >
            {t('edit_continue_to')}
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
                {t('verify_submitting')}
              </span>
            ) : t('verify_submit_btn')}
          </button>
        )}
      </div>
    </div>
  )
}
