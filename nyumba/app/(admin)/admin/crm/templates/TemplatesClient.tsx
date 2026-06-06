'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Template = {
  id: string
  name: string
  category: string
  message: string
  is_active: boolean
}

const categoryEmojis: Record<string, string> = {
  greeting: '👋', followup: '🔄', viewing: '🏠',
  closing: '✅', reminder: '⏰', general: '💬',
}

export default function TemplatesClient() {
  const supabase = createClient()
  const [templates, setTemplates] = useState<Template[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', category: 'general', message: '' })

  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('is_active', true)
      .order('category')
    setTemplates((data as Template[]) || [])
  }, [supabase])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  async function addTemplate() {
    if (!form.name || !form.message) return
    await supabase.from('whatsapp_templates').insert(form)
    setForm({ name: '', category: 'general', message: '' })
    setShowAdd(false)
    fetchTemplates()
  }

  async function deleteTemplate(id: string) {
    await supabase.from('whatsapp_templates').update({ is_active: false }).eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  function copyTemplate(id: string, message: string) {
    navigator.clipboard.writeText(message).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">💬 WhatsApp Templates</h1>
            <p className="text-green-100 text-xs">{templates.length} templates</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="bg-white text-[#1D9E75] text-xs px-4 py-2 rounded-xl font-bold">
            ➕ Ongeza
          </button>
        </div>
      </header>

      <div className="px-4 py-4 space-y-6">
        {Object.entries(grouped).map(([category, temps]) => (
          <div key={category}>
            <p className="font-semibold text-sm text-gray-700 mb-3">
              {categoryEmojis[category] || '💬'}{' '}
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </p>
            <div className="space-y-3">
              {temps.map(t => (
                <div key={t.id} className="bg-white rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm text-gray-800">{t.name}</p>
                    <div className="flex gap-2 flex-shrink-0 ml-2">
                      <button onClick={() => copyTemplate(t.id, t.message)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                          copied === t.id
                            ? 'bg-green-500 text-white'
                            : 'bg-[#25D366] text-white'
                        }`}>
                        {copied === t.id ? '✅ Imekopwa' : '📋 Copy'}
                      </button>
                      <button onClick={() => deleteTemplate(t.id)}
                        className="bg-red-100 text-red-600 text-xs px-2 py-1.5 rounded-lg">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{t.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Variables: <span className="font-mono">{'{jina}'}</span>{' '}
                    <span className="font-mono">{'{dalali}'}</span>{' '}
                    <span className="font-mono">{'{mkoa}'}</span>{' '}
                    <span className="font-mono">{'{tarehe}'}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-gray-400 text-sm">Hakuna templates — ongeza ya kwanza</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">➕ Template Mpya</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Jina la template" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none" />
              <select value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none">
                <option value="greeting">👋 Greeting</option>
                <option value="followup">🔄 Follow-up</option>
                <option value="viewing">🏠 Viewing</option>
                <option value="closing">✅ Closing</option>
                <option value="reminder">⏰ Reminder</option>
                <option value="general">💬 General</option>
              </select>
              <textarea
                placeholder={`Andika template hapa...\nTumia {jina} kwa jina la lead\nTumia {dalali} kwa jina lako\nTumia {mkoa} kwa mkoa\nTumia {tarehe} kwa tarehe`}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                rows={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none" />
              <button onClick={addTemplate} disabled={!form.name || !form.message}
                className="w-full bg-[#1D9E75] text-white py-4 rounded-2xl font-bold disabled:opacity-50">
                ➕ Hifadhi Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
