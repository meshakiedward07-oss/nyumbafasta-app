'use client'
import { useState, useEffect } from 'react'
import { PIPELINE_STAGES, SOURCE_LABELS, type DalaliLead } from '@/lib/crm/constants'

type Activity = {
  id:        string
  type:      string
  direction: string
  content:   string
  created_at: string
  staff?:    { full_name?: string } | null
}

const TYPE_EMOJI: Record<string, string> = {
  call:     '📞',
  whatsapp: '💬',
  note:     '📝',
  sms:      '📱',
  email:    '✉️',
}

export default function LeadDetailModal({
  lead,
  onClose,
  onUpdate,
}: {
  lead:     DalaliLead
  onClose:  () => void
  onUpdate: () => void
}) {
  const [tab, setTab]               = useState<'info' | 'history' | 'followup'>('info')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [note, setNote]             = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [followupNote, setFollowupNote] = useState('')
  const [actioning, setActioning]   = useState(false)

  useEffect(() => {
    fetchActivities()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  async function fetchActivities() {
    setLoadingActivities(true)
    const res = await fetch(`/api/v1/crm/leads/${lead.id}/activities`)
    const data = await res.json()
    setActivities(data.activities || [])
    setLoadingActivities(false)
  }

  async function callApi(url: string, body: unknown) {
    setActioning(true)
    try {
      await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      onUpdate()
      fetchActivities()
    } finally {
      setActioning(false)
    }
  }

  async function patchStage(newStage: string) {
    setActioning(true)
    try {
      await fetch(`/api/v1/crm/leads/${lead.id}/stage`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ stage: newStage }),
      })
      onUpdate()
      fetchActivities()
    } finally {
      setActioning(false)
    }
  }

  async function submitNote() {
    if (!note.trim()) return
    await callApi(`/api/v1/crm/leads/${lead.id}/note`, { note: note.trim() })
    setNote('')
  }

  async function submitFollowup() {
    if (!followupDate) return
    await callApi(`/api/v1/crm/leads/${lead.id}/followup`, {
      followup_at: new Date(followupDate).toISOString(),
      note:        followupNote || undefined,
    })
    setFollowupDate('')
    setFollowupNote('')
  }

  const currentStageIdx = PIPELINE_STAGES.findIndex(s => s.key === lead.pipeline_stage)
  const nextStage       = PIPELINE_STAGES[currentStageIdx + 1]
  const currentStage    = PIPELINE_STAGES[currentStageIdx]
  const phoneClean      = (lead.whatsapp || lead.phone || '').replace(/\D/g, '')

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden border-l">

        {/* ── Header ─────────────────────────────────── */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-bold text-lg text-gray-900 leading-tight">
                {lead.business_name || '—'}
              </h2>
              <p className="text-sm text-gray-500">{lead.phone}</p>
              {lead.region && (
                <p className="text-xs text-gray-400 mt-0.5">📍 {lead.region}</p>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-3 mt-0.5">
              <span className="text-xl">✕</span>
            </button>
          </div>

          {/* Pipeline progress bar */}
          <div className="flex gap-0.5 mb-1">
            {PIPELINE_STAGES.filter(s => s.key !== 'amepotea').map((s, i) => {
              const isPast   = i < currentStageIdx
              const isCurrent = i === currentStageIdx
              return (
                <div
                  key={s.key}
                  title={s.label}
                  className={`flex-1 h-1.5 rounded-full transition-all ${
                    isPast    ? 'bg-primary-500'
                    : isCurrent ? 'bg-primary-500 opacity-60'
                    : 'bg-gray-200'
                  }`}
                />
              )
            })}
          </div>
          <p className="text-xs text-center text-gray-500">
            {currentStage?.emoji} {currentStage?.label}
          </p>
        </div>

        {/* ── Quick Actions ────────────────────────── */}
        <div className="px-4 pt-3 pb-2 border-b flex-shrink-0 space-y-2">
          {/* Contact buttons */}
          <div className="flex gap-2">
            {phoneClean && (
              <a
                href={`https://wa.me/${phoneClean}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => callApi(`/api/v1/crm/leads/${lead.id}/activity`, { type: 'whatsapp' })}
                className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700
                  py-2.5 rounded-xl text-sm font-medium border border-green-200"
              >
                💬 WhatsApp
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:+${lead.phone.replace(/\D/g, '')}`}
                onClick={() => callApi(`/api/v1/crm/leads/${lead.id}/activity`, { type: 'call' })}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700
                  py-2.5 rounded-xl text-sm font-medium border border-blue-200"
              >
                📞 Piga Simu
              </a>
            )}
          </div>

          {/* Call result */}
          <div className="flex gap-1.5">
            {[
              { result: 'answered',    label: '✅ Alijibu' },
              { result: 'no_answer',   label: '🔕 Hakujibu' },
              { result: 'unreachable', label: '🚫 Hapatikani' },
            ].map(({ result, label }) => (
              <button
                key={result}
                disabled={actioning}
                onClick={() => callApi(`/api/v1/crm/leads/${lead.id}/call`, { result })}
                className="flex-1 text-xs py-1.5 border border-gray-200 rounded-lg
                  hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Stage progression */}
          {nextStage && nextStage.key !== 'amepotea' && (
            <button
              disabled={actioning}
              onClick={() => patchStage(nextStage.key)}
              className="w-full flex items-center justify-center gap-2 bg-primary-500 text-white
                py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              ↗ Hatua Inayofuata: {nextStage.emoji} {nextStage.label}
            </button>
          )}

          {/* Stage picker */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {PIPELINE_STAGES.map(s => (
              <button
                key={s.key}
                disabled={actioning}
                onClick={() => patchStage(s.key)}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium
                  transition-all disabled:opacity-50 ${
                  lead.pipeline_stage === s.key
                    ? `${s.bgClass} ${s.textClass} ring-1 ring-current`
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────── */}
        <div className="flex border-b flex-shrink-0">
          {[
            { id: 'info',     label: 'ℹ️ Info' },
            { id: 'history',  label: '📋 Historia' },
            { id: 'followup', label: '📅 Follow-up' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* INFO */}
          {tab === 'info' && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 space-y-2.5">
                {[
                  { label: '📞 Simu',     value: lead.phone },
                  { label: '💬 WhatsApp', value: lead.whatsapp },
                  { label: '📍 Mkoa',     value: lead.region },
                  { label: '📡 Chanzo',   value: SOURCE_LABELS[lead.source || ''] || lead.source },
                  {
                    label: '🔄 Mawasiliano',
                    value: `${lead.contact_attempts ?? 0} mara${lead.last_contacted_at
                      ? ` · Mwisho: ${new Date(lead.last_contacted_at).toLocaleDateString('sw-TZ')}`
                      : ''}`,
                  },
                  lead.converted_to_profile_id
                    ? { label: '✅ Akaunti',   value: 'Amesajili — akaunti imeunganishwa' }
                    : null,
                  lead.first_listing_at
                    ? { label: '🏠 Listing ya 1', value: `${new Date(lead.first_listing_at).toLocaleDateString('sw-TZ')}` }
                    : null,
                ].filter(Boolean).map((item, i) => item && (
                  <div key={i} className="flex items-start justify-between">
                    <span className="text-xs text-gray-400">{item.label}</span>
                    <span className="text-xs font-medium text-gray-700 text-right max-w-[60%]">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {lead.notes && (
                <div className="bg-yellow-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-1">📝 Maelezo</p>
                  <p className="text-xs text-yellow-700">{lead.notes}</p>
                </div>
              )}

              {lead.next_followup_at && (
                <div className={`rounded-xl p-3 ${
                  new Date(lead.next_followup_at) <= new Date()
                    ? 'bg-amber-50 border border-amber-200'
                    : 'bg-blue-50'
                }`}>
                  <p className="text-xs font-medium text-blue-800 mb-0.5">📅 Follow-up Iliyopangwa</p>
                  <p className="text-xs text-blue-600">
                    {new Date(lead.next_followup_at).toLocaleDateString('sw-TZ', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                    {new Date(lead.next_followup_at) <= new Date() && (
                      <span className="ml-1 text-amber-600 font-medium"> — ilikwisha!</span>
                    )}
                  </p>
                </div>
              )}

              {lead.assigned_staff && (
                <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center
                    text-white text-xs font-bold flex-shrink-0">
                    {(lead.assigned_staff as { full_name?: string }).full_name?.[0] || '?'}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      {(lead.assigned_staff as { full_name?: string }).full_name || '—'}
                    </p>
                    <p className="text-xs text-gray-400">Staff aliyegawiwa</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HISTORY */}
          {tab === 'history' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Andika kumbuka hapa..."
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2
                    focus:outline-none focus:border-primary-500"
                  onKeyDown={e => { if (e.key === 'Enter' && note.trim()) submitNote() }}
                />
                <button
                  onClick={submitNote}
                  disabled={!note.trim() || actioning}
                  className="bg-gray-800 text-white px-3 rounded-xl text-sm disabled:opacity-50"
                >
                  💾
                </button>
              </div>

              {loadingActivities ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">
                  Hakuna historia bado — anza kuwasiliana
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map(a => (
                    <div key={a.id} className="flex gap-2.5">
                      <span className="text-base mt-0.5 flex-shrink-0">
                        {TYPE_EMOJI[a.type] || '•'}
                      </span>
                      <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-xs text-gray-700">{a.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {(a.staff as { full_name?: string } | null)?.full_name || 'System'}
                          {' · '}
                          {new Date(a.created_at).toLocaleDateString('sw-TZ', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FOLLOW-UP */}
          {tab === 'followup' && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">📅 Panga Follow-up Mpya</p>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tarehe na Wakati</label>
                  <input
                    type="datetime-local"
                    value={followupDate}
                    onChange={e => setFollowupDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Kumbuka (hiari)</label>
                  <input
                    type="text"
                    value={followupNote}
                    onChange={e => setFollowupNote(e.target.value)}
                    placeholder="Mfano: Piga simu kuhusu usajili"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm
                      focus:outline-none focus:border-primary-500"
                  />
                </div>
                <button
                  onClick={submitFollowup}
                  disabled={!followupDate || actioning}
                  className="w-full bg-primary-500 text-white py-3 rounded-xl text-sm font-semibold
                    disabled:opacity-50"
                >
                  {actioning ? 'Inahifadhi...' : '📅 Panga Follow-up'}
                </button>
              </div>

              {/* Quick presets */}
              <p className="text-xs font-medium text-gray-500">Haraka:</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Kesho 9am',    hours: 18 },
                  { label: 'Siku 3',       hours: 72 },
                  { label: 'Wiki 1',       hours: 168 },
                ].map(preset => {
                  const d = new Date(Date.now() + preset.hours * 3600000)
                  d.setHours(9, 0, 0, 0)
                  const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)
                  return (
                    <button
                      key={preset.label}
                      onClick={() => setFollowupDate(isoLocal)}
                      className="text-xs bg-white border border-gray-200 rounded-xl px-3 py-1.5
                        hover:bg-gray-50"
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>

              {/* Mark as lost */}
              <div className="pt-4 border-t">
                <button
                  disabled={actioning}
                  onClick={() => patchStage('amepotea')}
                  className="w-full text-xs text-gray-400 py-2 hover:text-red-500 transition-colors
                    disabled:opacity-50"
                >
                  Weka kama Amepotea — hawezi kupatikana
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
