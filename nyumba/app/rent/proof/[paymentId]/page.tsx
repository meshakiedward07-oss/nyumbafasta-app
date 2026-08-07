'use client'
import { useEffect, useRef, useState, use } from 'react'
import Link from 'next/link'

interface Payment {
  id: string; lease_id: string; status: string
  amount_due: number; amount_paid: number | null
  due_date: string; paid_date: string | null
  proof_url: string | null; proof_note: string | null
  proof_uploaded_at: string | null; verified_at: string | null
}

interface LeaseInfo {
  id: string; monthly_rent: number; start_date: string; end_date: string | null; status: string
  unit: { unit_number: string; unit_type: string } | null
  listing: { title: string; district: string; region: string } | null
}

interface Banking {
  bank_name: string; account_name: string; account_number: string
  branch: string | null; mobile_money_number: string | null
  mobile_money_provider: string | null; additional_instructions: string | null
}

interface AiExtracted {
  amount:     number | null
  date:       string | null
  reference:  string | null
  method:     string | null
  confidence: 'high' | 'medium' | 'low'
}

function dateFmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('sw-TZ', { day: '2-digit', month: 'long', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: string }> = {
    pending:        { label: 'Inasubiri Malipo',   cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: 'clock'        },
    partial:        { label: 'Ilipwa Kidogo',       cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: 'circle-half' },
    proof_uploaded: { label: 'Ushahidi Umepakiwa', cls: 'bg-blue-50 text-blue-700 border-blue-200',    icon: 'upload'       },
    paid:           { label: 'Imelipwa',            cls: 'bg-green-50 text-green-700 border-green-200', icon: 'circle-check' },
    void:           { label: 'Imebatilishwa',       cls: 'bg-gray-100 text-gray-400 border-gray-200',   icon: 'ban'          },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'help-circle' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${s.cls}`}>
      <i className={`ti ti-${s.icon}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}

const METHOD_LABELS: Record<string, string> = {
  mpesa: 'M-Pesa', airtel: 'Airtel Money', tigopesa: 'Tigo Pesa',
  halopesa: 'HaloPesa', cash: 'Pesa Taslimu', bank_transfer: 'Benki', other: 'Nyingine',
}

type Step = 'upload' | 'ai_review' | 'confirm' | 'done'

export default function TenantProofPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = use(params)

  const [payment, setPayment] = useState<Payment | null>(null)
  const [lease,   setLease]   = useState<LeaseInfo | null>(null)
  const [banking, setBanking] = useState<Banking | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [authErr, setAuthErr] = useState<string | null>(null)

  // Upload flow state
  const [step,          setStep]         = useState<Step>('upload')
  const [file,          setFile]         = useState<File | null>(null)
  const [preview,       setPreview]      = useState<string | null>(null)
  const [uploading,     setUploading]    = useState(false)
  const [uploadedUrl,   setUploadedUrl]  = useState<string | null>(null)
  const [parsing,       setParsing]      = useState(false)
  const [aiData,        setAiData]       = useState<AiExtracted | null>(null)

  // Form fields (editable after AI fill)
  const [proofNote,     setProofNote]    = useState('')
  const [aiAmount,      setAiAmount]     = useState('')
  const [aiDate,        setAiDate]       = useState('')
  const [aiReference,   setAiReference]  = useState('')
  const [aiMethod,      setAiMethod]     = useState('cash')

  const [submitting,    setSubmitting]   = useState(false)
  const [submitErr,     setSubmitErr]    = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/v1/payments/rent/${paymentId}`)
        if (res.status === 401) { setAuthErr('login'); return }
        if (res.status === 403) { setAuthErr('forbidden'); return }
        if (!res.ok)            { setAuthErr('notfound'); return }
        const data = await res.json()
        setPayment(data.payment)
        setLease(data.lease)
        setBanking(data.banking)
        setOrgName(data.org_name)
      } catch { setAuthErr('error') }
      finally  { setLoading(false) }
    }
    load()
  }, [paymentId])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setStep('upload')
    setAiData(null)
    setUploadedUrl(null)
  }

  async function handleUploadAndParse() {
    if (!file) return
    setSubmitErr(null)

    try {
      // 1. Run OCR in the browser (Tesseract.js — free, on-device, no API key)
      setParsing(true)
      const { ocrAndParse } = await import('@/lib/ocr/parseReceipt')
      const parsed = await ocrAndParse(file, (pct) => {
        // progress 0-100 — keep parsing state active
        void pct
      })
      setParsing(false)

      setAiData(parsed)
      if (parsed.amount)    setAiAmount(String(parsed.amount))
      if (parsed.date)      setAiDate(parsed.date)
      if (parsed.reference) setAiReference(parsed.reference)
      if (parsed.method)    setAiMethod(parsed.method)

      // 2. Upload to Cloudinary (runs in parallel after OCR — image is needed for org to review)
      setUploading(true)
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/v1/upload/listing', { method: 'POST', body: fd })
      const uploadData = await uploadRes.json()
      setUploading(false)
      if (!uploadRes.ok || !uploadData.url) {
        setSubmitErr(uploadData.error ?? 'Imeshindwa kupakia picha.')
        return
      }
      setUploadedUrl(uploadData.url as string)

      setStep('ai_review')
    } catch {
      setSubmitErr('Imeshindwa kusoma risiti. Angalia muunganiko wako.')
      setParsing(false)
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!uploadedUrl) return
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const aiExtracted = aiData ? {
        amount: aiAmount ? Number(aiAmount) : null,
        date:   aiDate || null,
        reference: aiReference || null,
        method: aiMethod || null,
        confidence: aiData.confidence,
      } : null

      // Build proof_note from confirmed fields
      const parts: string[] = []
      if (aiReference) parts.push(`Kumbukumbu: ${aiReference}`)
      if (aiMethod)    parts.push(METHOD_LABELS[aiMethod] ?? aiMethod)
      if (proofNote)   parts.push(proofNote)
      const finalNote = parts.join(' · ') || null

      const res = await fetch(`/api/v1/payments/rent/${paymentId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          proof_url:    uploadedUrl,
          proof_note:   finalNote,
          ai_extracted: aiExtracted,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitErr(data.error ?? 'Imeshindwa kutuma.'); return }
      setPayment(data.payment)
      setStep('done')
    } catch { setSubmitErr('Imeshindwa kutuma. Jaribu tena.') }
    finally   { setSubmitting(false) }
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
        </div>
      </div>
    )
  }

  // ── Auth / error ──────────────────────────────────────────────────────────────
  if (authErr) {
    const msgs: Record<string, { icon: string; title: string; body: string }> = {
      login:     { icon: 'lock',         title: 'Ingia kwanza',           body: 'Unahitaji kuingia katika akaunti yako.' },
      forbidden: { icon: 'shield-off',   title: 'Huna ruhusa',            body: 'Huna ruhusa ya kuona malipo haya.' },
      notfound:  { icon: 'file-unknown', title: 'Malipo hayapatikani',     body: 'Wasiliana na mmiliki wako.' },
      error:     { icon: 'wifi-off',     title: 'Hitilafu ya muunganiko',  body: 'Imeshindwa kupakia. Jaribu tena.' },
    }
    const m = msgs[authErr] ?? msgs.error
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className={`ti ti-${m.icon} text-3xl text-red-400`} aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">{m.title}</h2>
          <p className="text-sm text-gray-500 mb-6">{m.body}</p>
          {authErr === 'login' && (
            <Link href={`/login?redirect=/rent/proof/${paymentId}`}>
              <button className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold">Ingia Sasa</button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!payment || !lease) return null

  const unit    = lease.unit    as unknown as { unit_number: string } | null
  const listing = lease.listing as unknown as { title: string; district: string } | null
  const canUpload = !['paid', 'void'].includes(payment.status)

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ti ti-circle-check text-4xl text-green-500" aria-hidden="true" />
          </div>
          <h2 className="font-bold text-gray-900 text-xl mb-2">Ushahidi Umetumwa!</h2>
          <p className="text-sm text-gray-500 mb-1">Mmiliki ataangalia risiti yako na atathibitisha malipo.</p>
          <p className="text-sm text-gray-400 mb-6">Utapata arifa ukisha thibitishwa.</p>
          {uploadedUrl && (
            <div className="bg-gray-50 rounded-2xl overflow-hidden mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedUrl} alt="Risiti" className="w-full h-40 object-cover" />
            </div>
          )}
          <Link href="/tenant">
            <button className="w-full border border-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm">
              Rudi Nyumbani
            </button>
          </Link>
        </div>
      </div>
    )
  }

  // ── Main page ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <i className="ti ti-home text-primary-600 text-base" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">{orgName ?? 'NyumbaFasta'}</p>
            <p className="font-semibold text-gray-900 text-sm truncate">{listing?.title ?? 'Malipo ya Kodi'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">

        {/* Payment summary */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-gray-900">TZS {payment.amount_due.toLocaleString()}</p>
              {unit && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                  <i className="ti ti-door" aria-hidden="true" />
                  {unit.unit_number}{listing && ` · ${listing.district}`}
                </p>
              )}
            </div>
            <StatusBadge status={payment.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Tarehe ya Malipo</p>
              <p className="font-medium text-gray-700">{dateFmt(payment.due_date)}</p>
            </div>
            {payment.verified_at && (
              <div className="col-span-2">
                <p className="text-xs text-green-400">
                  <i className="ti ti-shield-check" aria-hidden="true" /> Imethibitishwa {dateFmt(payment.verified_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Already paid */}
        {payment.status === 'paid' && (
          <div className="bg-green-50 border border-green-100 rounded-2xl p-5 text-center">
            <i className="ti ti-circle-check text-4xl text-green-500" aria-hidden="true" />
            <p className="font-semibold text-green-800 mt-2">Malipo yamethibitishwa</p>
            <Link href={`/rent/receipt/${paymentId}`}
              className="mt-4 inline-flex items-center gap-2 bg-white border border-green-200 text-green-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-green-50 transition">
              <i className="ti ti-file-download" aria-hidden="true" />Pakua Risiti
            </Link>
          </div>
        )}

        {/* Awaiting verification notice */}
        {payment.status === 'proof_uploaded' && step !== 'ai_review' && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
            <i className="ti ti-clock-hour-4 text-xl text-blue-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium text-blue-800 text-sm">Inasubiri uthibitisho</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Ushahidi wako umepakiwa. Mmiliki ataona na atathibitisha hivi karibuni.
              </p>
            </div>
          </div>
        )}

        {/* Banking info */}
        {!['paid','void'].includes(payment.status) && banking && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <i className="ti ti-building-bank" aria-hidden="true" />Maelezo ya Malipo
            </p>
            <div className="space-y-2.5">
              <Row label="Benki"             value={banking.bank_name} />
              <Row label="Jina la Akaunti"   value={banking.account_name} />
              <Row label="Nambari ya Akaunti" value={banking.account_number} bold />
              {banking.branch && <Row label="Tawi" value={banking.branch} />}
              {banking.mobile_money_number && (
                <Row label={`Nambari ya ${banking.mobile_money_provider ?? 'Simu'}`}
                     value={banking.mobile_money_number} bold />
              )}
              {banking.additional_instructions && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-0.5">Maelezo ya Ziada</p>
                  <p className="text-sm text-gray-700">{banking.additional_instructions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Proof upload section ─────────────────────────────────────────── */}
        {canUpload && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
              <i className="ti ti-upload" aria-hidden="true" />Pakia Risiti ya Malipo
            </p>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Step: upload — select file */}
            {step === 'upload' && !preview && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-10 text-gray-400 hover:border-primary-300 hover:text-primary-500 transition"
                >
                  <i className="ti ti-camera text-4xl" aria-hidden="true" />
                  <span className="text-sm font-medium">Piga picha ya risiti</span>
                  <span className="text-xs text-gray-400">au chagua kutoka kwenye galari</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-600 transition flex items-center justify-center gap-2"
                >
                  <i className="ti ti-photo" aria-hidden="true" />Chagua Picha
                </button>
              </div>
            )}

            {/* Step: preview selected file */}
            {step === 'upload' && preview && (
              <div className="space-y-3">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Risiti iliyochaguliwa" className="w-full max-h-64 object-contain rounded-xl bg-gray-50" />
                  <button
                    onClick={() => { setFile(null); setPreview(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow text-gray-500 hover:text-red-500"
                  >
                    <i className="ti ti-x text-sm" aria-hidden="true" />
                  </button>
                </div>

                <div className="bg-primary-50 rounded-xl p-3 text-xs text-primary-700 flex items-start gap-2">
                  <i className="ti ti-scan text-base flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Programu itasoma maandishi kwenye risiti hii na kujaza taarifa kiotomatiki. Utaweza kuangalia na kurekebisha kabla ya kutuma.</span>
                </div>

                <button
                  onClick={handleUploadAndParse}
                  disabled={uploading || parsing}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-600 transition flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inasoma risiti...</>
                  ) : uploading ? (
                    <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inapakia picha...</>
                  ) : (
                    <><i className="ti ti-scan" aria-hidden="true" />Soma Risiti</>
                  )}
                </button>

                <button
                  onClick={() => { setFile(null); setPreview(null) }}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
                >
                  Chagua Picha Nyingine
                </button>
              </div>
            )}

            {/* Step: AI review */}
            {step === 'ai_review' && uploadedUrl && (
              <div className="space-y-4">
                {/* Receipt preview */}
                <div className="rounded-xl overflow-hidden bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploadedUrl} alt="Risiti" className="w-full max-h-48 object-contain" />
                </div>

                {/* AI confidence badge */}
                {aiData && (
                  <div className={`rounded-xl p-3 flex items-start gap-2 text-xs ${
                    aiData.confidence === 'high'   ? 'bg-green-50 text-green-700' :
                    aiData.confidence === 'medium' ? 'bg-amber-50 text-amber-700' :
                                                     'bg-gray-50 text-gray-500'
                  }`}>
                    <i className="ti ti-robot text-base flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>
                      {aiData.confidence === 'high'
                        ? 'AI ilisoma risiti yako vizuri. Angalia taarifa zilizopatikana hapa chini.'
                        : aiData.confidence === 'medium'
                        ? 'AI ilisoma risiti lakini baadhi ya taarifa si wazi kabisa. Tafadhali angalia na urekebishe.'
                        : 'AI ilikuwa na ugumu kusoma risiti hii. Tafadhali jaza taarifa mwenyewe.'}
                    </span>
                  </div>
                )}

                {/* Editable extracted fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Kiasi Kilicholipwa (TZS) <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="number"
                      value={aiAmount}
                      onChange={e => setAiAmount(e.target.value)}
                      placeholder={`${payment.amount_due.toLocaleString()}`}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Tarehe ya Malipo</label>
                      <input
                        type="date"
                        value={aiDate}
                        onChange={e => setAiDate(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Njia ya Malipo</label>
                      <select
                        value={aiMethod}
                        onChange={e => setAiMethod(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
                      >
                        {Object.entries(METHOD_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Nambari ya Muamala</label>
                    <input
                      type="text"
                      value={aiReference}
                      onChange={e => setAiReference(e.target.value)}
                      placeholder="Mfano: MPZ123456789"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Maelezo ya Ziada</label>
                    <input
                      type="text"
                      value={proofNote}
                      onChange={e => setProofNote(e.target.value)}
                      placeholder="Maelezo yoyote..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                </div>

                {submitErr && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                    <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />
                    {submitErr}
                  </div>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !aiAmount}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-primary-600 transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><i className="ti ti-loader-2 animate-spin" aria-hidden="true" />Inatuma...</>
                  ) : (
                    <><i className="ti ti-send" aria-hidden="true" />Tuma kwa Mmiliki</>
                  )}
                </button>

                <button
                  onClick={() => { setFile(null); setPreview(null); setStep('upload'); setAiData(null) }}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
                >
                  <i className="ti ti-arrow-left text-xs mr-1" aria-hidden="true" />Rudi — pakia picha nyingine
                </button>
              </div>
            )}

            {submitErr && step !== 'ai_review' && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                <i className="ti ti-alert-circle flex-shrink-0" aria-hidden="true" />
                {submitErr}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">NyumbaFasta · Usimamizi wa Malipo ya Kodi</p>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <p className="text-xs text-gray-400 flex-shrink-0">{label}</p>
      <p className={`text-sm text-right ${bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}
