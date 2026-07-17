'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const CATEGORIES = [
  'Nyumba na Mali', 'Hoteli na Lodges', 'Biashara ya Chakula', 'Afya na Dawa',
  'Elimu', 'Usafiri', 'Fedha na Bima', 'Teknolojia', 'Nguo na Mitindo',
  'Sanaa na Burudani', 'Kilimo', 'Ujenzi na Nyenzo', 'Mengineyo',
]

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = searchParams.get('plan')

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    if (step === 1) { setStep(2); return }

    if (form.password !== form.confirm_password) {
      setError('Nywila hazifanani'); return
    }
    if (form.password.length < 8) {
      setError('Nywila iwe na angalau herufi 8'); return
    }

    setLoading(true); setError('')
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Jiandikishe kwa Matangazo</h1>
          <p className="text-gray-500 text-sm mt-1">Hatua {step} kati ya 2</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jina la Biashara *</label>
                <input
                  required value={form.business_name}
                  onChange={e => set('business_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="Mfano: Hotel ya Mbuni, Duka la Nguruwe..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aina ya Biashara *</label>
                <select
                  required value={form.business_category}
                  onChange={e => set('business_category', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Chagua aina...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Simu *</label>
                  <input
                    required type="tel" value={form.contact_phone}
                    onChange={e => set('contact_phone', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="0712345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input
                    type="tel" value={form.whatsapp_number}
                    onChange={e => set('whatsapp_number', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="0712345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mkoa / Mji *</label>
                  <input
                    required value={form.city}
                    onChange={e => set('city', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Dar es Salaam"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wilaya</label>
                  <input
                    value={form.district}
                    onChange={e => set('district', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                    placeholder="Kinondoni"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maelezo ya Biashara</label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  placeholder="Eleza biashara yako kwa ufupi..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tovuti (hiari)</label>
                <input
                  type="url" value={form.website_url}
                  onChange={e => set('website_url', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="https://..."
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                Unda akaunti yako ya mfanyabiashara ili uweze kusimamia matangazo yako.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barua pepe *</label>
                <input
                  required type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="biashara@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nywila *</label>
                <input
                  required type="password" value={form.password}
                  onChange={e => set('password', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="Angalau herufi 8"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thibitisha Nywila *</label>
                <input
                  required type="password" value={form.confirm_password}
                  onChange={e => set('confirm_password', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  placeholder="Rudia nywila"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            {step === 2 && (
              <button
                type="button" onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
              >
                Rudi
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-primary-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition disabled:opacity-50"
            >
              {loading ? 'Inasajili...' : step === 1 ? 'Endelea →' : 'Unda Akaunti'}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Una akaunti tayari?{' '}
          <Link href="/advertising/login" className="text-primary-600 font-medium hover:underline">
            Ingia hapa
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
