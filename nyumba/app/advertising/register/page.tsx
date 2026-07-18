'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

const CATEGORIES = [
  'Nyumba na Mali', 'Hoteli na Lodges', 'Biashara ya Chakula', 'Afya na Dawa',
  'Elimu', 'Usafiri', 'Fedha na Bima', 'Teknolojia', 'Nguo na Mitindo',
  'Sanaa na Burudani', 'Kilimo', 'Ujenzi na Nyenzo', 'Mengineyo',
]

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan')

  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)

  const [form, setForm] = useState({
    business_name: '', business_category: '', contact_phone: '',
    whatsapp_number: '', city: '', district: '', description: '', website_url: '',
    email: '', password: '', confirm_password: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (step === 1) {
      if (!form.business_name || !form.business_category || !form.contact_phone || !form.whatsapp_number || !form.city) {
        setError('Jaza sehemu zote zinazohitajika (*)'); return
      }
      setStep(2); return
    }
    if (form.password !== form.confirm_password) { setError('Nywila hazifanani'); return }
    if (form.password.length < 8) { setError('Nywila iwe na angalau herufi 8'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/v1/advertising/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Kuna tatizo'); return }
      router.push(planId ? `/advertising/new?plan=${planId}` : '/advertising/dashboard')
    } catch {
      setError('Haikuweza kuunganika. Jaribu tena.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Branded header */}
      <div className="bg-gradient-to-r from-[#085041] to-primary-600 px-4 py-5 text-center text-white">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded-lg" />
          <span className="font-bold text-base">NyumbaFasta</span>
        </div>
        <p className="text-xs text-primary-200">Sajili Biashara yako — Bure</p>
      </div>

      <div className="flex-1 flex items-start justify-center pt-6 px-4 pb-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-6">

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[
              { n: 1, label: 'Biashara' },
              { n: 2, label: 'Akaunti' },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 ${i > 0 ? 'flex-1' : ''}`}>
                  {i > 0 && (
                    <div className={`h-0.5 flex-1 transition-colors ${step >= s.n ? 'bg-primary-400' : 'bg-gray-200'}`} />
                  )}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    step >= s.n ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s.n ? '✓' : s.n}
                  </div>
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${step >= s.n ? 'text-primary-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <h1 className="text-lg font-bold text-gray-800 mb-4">
            {step === 1 ? 'Taarifa za Biashara Yako' : 'Unda Akaunti Yako'}
          </h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4 flex items-start gap-2">
              <span className="flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {step === 1 && (
              <>
                <Field label="Jina la Biashara *" required>
                  <input
                    required value={form.business_name}
                    onChange={e => set('business_name', e.target.value)}
                    className="input"
                    placeholder="Mfano: Duka la Nguruwe, Salon ya Amina..."
                  />
                </Field>

                <Field label="Aina ya Biashara *" required>
                  <select
                    required value={form.business_category}
                    onChange={e => set('business_category', e.target.value)}
                    className="input"
                  >
                    <option value="">Chagua aina...</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nambari ya Simu *">
                    <input
                      required type="tel" value={form.contact_phone}
                      onChange={e => set('contact_phone', e.target.value)}
                      className="input" placeholder="0712345678"
                    />
                  </Field>
                  <Field label="WhatsApp *">
                    <input
                      required type="tel" value={form.whatsapp_number}
                      onChange={e => set('whatsapp_number', e.target.value)}
                      className="input" placeholder="255712345678"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Wateja watabonyeza hadi WhatsApp yako</p>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mji / Mkoa *">
                    <input
                      required value={form.city}
                      onChange={e => set('city', e.target.value)}
                      className="input" placeholder="Dar es Salaam"
                    />
                  </Field>
                  <Field label="Wilaya">
                    <input
                      value={form.district}
                      onChange={e => set('district', e.target.value)}
                      className="input" placeholder="Kinondoni"
                    />
                  </Field>
                </div>

                <Field label="Maelezo ya Biashara (hiari)">
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    rows={3}
                    className="input resize-none"
                    placeholder="Eleza biashara yako kwa ufupi..."
                  />
                </Field>

                <Field label="Tovuti (hiari)">
                  <input
                    type="url" value={form.website_url}
                    onChange={e => set('website_url', e.target.value)}
                    className="input" placeholder="https://..."
                  />
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-3 text-sm text-primary-800 flex items-start gap-2">
                  <span>✅</span>
                  <span>Taarifa za biashara zimehifadhiwa. Sasa unda akaunti ya kuingia.</span>
                </div>

                <Field label="Barua Pepe *">
                  <input
                    required type="email" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    className="input" placeholder="biashara@email.com"
                    autoComplete="email"
                  />
                </Field>

                <Field label="Nywila *">
                  <div className="relative">
                    <input
                      required type={showPw ? 'text' : 'password'} value={form.password}
                      onChange={e => set('password', e.target.value)}
                      className="input pr-16" placeholder="Angalau herufi 8"
                      autoComplete="new-password"
                    />
                    <button
                      type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                    >
                      {showPw ? 'Ficha' : 'Onyesha'}
                    </button>
                  </div>
                </Field>

                <Field label="Thibitisha Nywila *">
                  <input
                    required type={showPw ? 'text' : 'password'} value={form.confirm_password}
                    onChange={e => set('confirm_password', e.target.value)}
                    className="input" placeholder="Rudia nywila"
                    autoComplete="new-password"
                  />
                </Field>
              </>
            )}

            <div className="flex gap-3 pt-2">
              {step === 2 && (
                <button
                  type="button" onClick={() => { setStep(1); setError('') }}
                  className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  ← Rudi
                </button>
              )}
              <button
                type="submit" disabled={loading}
                className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50"
              >
                {loading ? 'Inasajili...' : step === 1 ? 'Endelea →' : 'Unda Akaunti'}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Una akaunti tayari?{' '}
            <Link href="/advertising/login" className="text-primary-600 font-semibold hover:underline">
              Ingia hapa
            </Link>
          </p>
        </div>
      </div>

      <style>{`.input { width: 100%; border: 1px solid #d1d5db; border-radius: 12px; padding: 10px 14px; font-size: 14px; outline: none; } .input:focus { border-color: #1D9E75; box-shadow: 0 0 0 3px rgba(29,158,117,0.12); }`}</style>
    </div>
  )
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
