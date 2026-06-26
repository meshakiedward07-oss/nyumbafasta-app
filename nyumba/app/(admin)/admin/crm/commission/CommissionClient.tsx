'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Commission = {
  id: string
  lead_id: string
  dalali_id: string
  deal_value: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'approved' | 'paid'
  paid_at?: string
  created_at: string
  agent_leads?: { business_name?: string; region?: string }
  users?: { full_name?: string }
}

type NewCommission = {
  lead_id: string
  dalali_id: string
  deal_value: number
  commission_rate: number
  notes: string
}

export default function CommissionClient() {
  const supabase = createClient()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'paid'>('all')

  const [form, setForm] = useState<NewCommission>({
    lead_id: '', dalali_id: '', deal_value: 0, commission_rate: 5, notes: '',
  })

  const [leads, setLeads] = useState<{ id: string; business_name?: string }[]>([])
  const [madalali, setMadalali] = useState<{ id: string; full_name?: string }[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [commRes, leadsRes, dalaliRes] = await Promise.all([
      supabase.from('commissions')
        .select('*, agent_leads(business_name, region), users!commissions_dalali_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('agent_leads').select('id, business_name').eq('pipeline_stage', 'closed').limit(50),
      supabase.from('users').select('id, full_name').eq('role', 'dalali'),
    ])
    setCommissions((commRes.data as Commission[]) || [])
    setLeads(leadsRes.data || [])
    setMadalali(dalaliRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addCommission() {
    if (!form.lead_id || !form.dalali_id || form.deal_value <= 0) return
    setSaving(true)
    try {
      await supabase.from('commissions').insert({
        lead_id: form.lead_id,
        dalali_id: form.dalali_id,
        deal_value: form.deal_value,
        commission_rate: form.commission_rate,
        commission_amount: Math.floor(form.deal_value * (form.commission_rate / 100)),
        status: 'pending',
        notes: form.notes || null,
      })
      setShowAdd(false)
      setForm({ lead_id: '', dalali_id: '', deal_value: 0, commission_rate: 5, notes: '' })
      fetchAll()
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id: string, status: Commission['status']) {
    await supabase.from('commissions').update({
      status,
      ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}),
    }).eq('id', id)
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status, ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}) } : c))
  }

  const filtered = filterStatus === 'all' ? commissions : commissions.filter(c => c.status === filterStatus)

  const totalPending = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0)
  const totalPaid = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0)

  const statusStyles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-primary-500 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-white font-bold text-lg">💼 Commission Tracking</h1>
          <button onClick={() => setShowAdd(true)}
            className="bg-white text-primary-500 text-xs px-4 py-2 rounded-xl font-bold">
            + Ongeza
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl px-3 py-2">
            <p className="text-green-100 text-xs">Inayosubiri Kulipwa</p>
            <p className="text-white font-bold">Tsh {totalPending.toLocaleString()}</p>
          </div>
          <div className="bg-white/20 rounded-xl px-3 py-2">
            <p className="text-green-100 text-xs">Imelipwa</p>
            <p className="text-white font-bold">Tsh {totalPaid.toLocaleString()}</p>
          </div>
        </div>
      </header>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Ongeza Commission</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Funga" className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Lead (Deal Iliyofungwa)</label>
                <select value={form.lead_id} onChange={e => setForm(f => ({ ...f, lead_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm">
                  <option value="">Chagua lead...</option>
                  {leads.map(l => <option key={l.id} value={l.id}>{l.business_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Dalali</label>
                <select value={form.dalali_id} onChange={e => setForm(f => ({ ...f, dalali_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm">
                  <option value="">Chagua dalali...</option>
                  {madalali.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Deal Value (Tsh)</label>
                <input type="number" value={form.deal_value || ''} placeholder="e.g. 5000000"
                  onChange={e => setForm(f => ({ ...f, deal_value: Number(e.target.value) }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Commission Rate: {form.commission_rate}%
                </label>
                <input type="range" min={1} max={15} value={form.commission_rate}
                  onChange={e => setForm(f => ({ ...f, commission_rate: Number(e.target.value) }))}
                  className="w-full accent-primary-500" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1%</span>
                  <span className="font-bold text-primary-500">
                    = Tsh {Math.floor(form.deal_value * (form.commission_rate / 100)).toLocaleString()}
                  </span>
                  <span>15%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Maelezo (Hiari)</label>
                <textarea value={form.notes} rows={2} placeholder="Maelezo ya ziada..."
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none" />
              </div>
              <button onClick={addCommission} disabled={saving || !form.lead_id || !form.dalali_id}
                className="w-full bg-primary-500 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {saving ? 'Inahifadhi...' : 'Hifadhi Commission'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'paid'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs px-4 py-2 rounded-xl font-medium capitalize transition-all ${
                filterStatus === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {s === 'all' ? 'Zote' : s}
            </button>
          ))}
        </div>

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="text-4xl mb-2">💼</div>
            <p className="text-gray-400 text-sm">Hakuna commission records</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-sm">{c.agent_leads?.business_name || 'Deal'}</p>
                <p className="text-xs text-gray-400">
                  👨‍💼 {c.users?.full_name || '—'} · 📍 {c.agent_leads?.region || '—'}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusStyles[c.status]}`}>
                {c.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-xs text-gray-400">Deal</p>
                <p className="text-xs font-bold">Tsh {c.deal_value.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-2 text-center">
                <p className="text-xs text-gray-400">Rate</p>
                <p className="text-xs font-bold">{c.commission_rate}%</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2 text-center">
                <p className="text-xs text-green-600">Commission</p>
                <p className="text-xs font-bold text-green-700">Tsh {c.commission_amount.toLocaleString()}</p>
              </div>
            </div>

            {c.status !== 'paid' && (
              <div className="flex gap-2">
                {c.status === 'pending' && (
                  <button onClick={() => updateStatus(c.id, 'approved')}
                    className="flex-1 bg-blue-500 text-white text-xs py-2 rounded-xl font-medium">
                    ✓ Approve
                  </button>
                )}
                {(c.status === 'pending' || c.status === 'approved') && (
                  <button onClick={() => updateStatus(c.id, 'paid')}
                    className="flex-1 bg-primary-500 text-white text-xs py-2 rounded-xl font-medium">
                    💳 Lipa
                  </button>
                )}
              </div>
            )}
            {c.paid_at && (
              <p className="text-xs text-green-600 mt-1">
                ✅ Imelipwa: {new Date(c.paid_at).toLocaleDateString('sw-TZ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
