'use client'
import { useState, useEffect, useCallback } from 'react'
import { PIPELINE_STAGES, SOURCE_LABELS, type DalaliLead } from '@/lib/crm/constants'

export default function StaffLeadsClient(props: {
  currentUserId: string
  isAdmin:       boolean
}) {
  const { isAdmin } = props
  const [leads, setLeads]       = useState<DalaliLead[]>([])
  const [loading, setLoading]   = useState(true)
  const [activeStage, setActiveStage] = useState('all')
  const [search, setSearch]     = useState('')
  const [stats, setStats]       = useState({ total: 0, active: 0, converted: 0, followupDue: 0 })

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const res = await fetch(
      `/api/v1/crm/leads?search=${encodeURIComponent(search)}`,
    )
    const data = await res.json()
    const rows: DalaliLead[] = data.leads || []

    const now = new Date()
    setLeads(rows)
    setStats({
      total:      rows.length,
      active:     rows.filter(l =>
        !['amefanikiwa', 'amepotea'].includes(l.pipeline_stage)
      ).length,
      converted:  rows.filter(l => l.pipeline_stage === 'amefanikiwa').length,
      followupDue: rows.filter(l =>
        l.next_followup_at && new Date(l.next_followup_at) <= now
      ).length,
    })
    setLoading(false)
  }, [search])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  async function updateStage(leadId: string, stage: string) {
    await fetch(`/api/v1/crm/leads/${leadId}/stage`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ stage }),
    })
    setLeads(prev => prev.map(l =>
      l.id === leadId ? { ...l, pipeline_stage: stage } : l,
    ))
  }

  const filtered = activeStage === 'all'
    ? leads
    : leads.filter(l => l.pipeline_stage === activeStage)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-primary-500 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-1">
          {isAdmin ? 'Leads za Wafanyakazi Wote' : 'Madalali Watarajiwa Wangu'}
        </h1>
        <p className="text-green-100 text-xs mb-3">
          {isAdmin
            ? 'Angalia na simamia leads za wafanyakazi wote'
            : 'Dalali watarajiwa uliogawiwa kwa kuwasiliana nao'}
        </p>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Jumla',     value: stats.total,      icon: 'chart-bar' },
            { label: 'Hai',       value: stats.active,     icon: 'refresh' },
            { label: 'Wamefaulu', value: stats.converted,  icon: 'circle-check' },
            { label: 'Follow-up', value: stats.followupDue, icon: 'clock' },
          ].map((s, i) => (
            <div key={i} className="bg-white/20 rounded-xl p-2 text-center">
              <i className={`ti ti-${s.icon} text-sm`} aria-hidden="true" />
              <div className="text-white font-bold text-sm">{s.value}</div>
              <div className="text-green-100 text-xs leading-none">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-xs" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta jina, simu..."
            className="w-full pl-8 pr-4 py-2 text-sm bg-white/20 text-white
              placeholder-white/60 rounded-xl focus:outline-none border border-white/20"
          />
        </div>
      </header>

      <div className="px-4 py-4">
        {/* Stage filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setActiveStage('all')}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
              activeStage === 'all' ? 'bg-primary-500 text-white' : 'bg-white text-gray-600'
            }`}
          >
            Zote ({leads.length})
          </button>
          {PIPELINE_STAGES.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
                activeStage === s.key ? 'bg-primary-500 text-white' : 'bg-white text-gray-600'
              }`}
            >
              <><i className={`ti ti-${s.icon}`} aria-hidden="true" /> {s.label} (</>
                {leads.filter(l => l.pipeline_stage === s.key).length}
              )
            </button>
          ))}
        </div>

        {/* Leads list */}
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-28 animate-pulse mb-3" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3 flex justify-center"><i className="ti ti-target text-gray-400" aria-hidden="true" /></div>
            <p className="text-gray-500 font-medium">
              {activeStage === 'all'
                ? isAdmin
                  ? 'Hakuna leads bado'
                  : 'Hujagawiwa leads bado — subiri admin'
                : `Hakuna leads za stage hii`}
            </p>
          </div>
        ) : filtered.map(lead => {
          const stage       = PIPELINE_STAGES.find(s => s.key === lead.pipeline_stage) || PIPELINE_STAGES[0]
          const isFollowup  = lead.next_followup_at && new Date(lead.next_followup_at) <= new Date()
          const phoneForWA  = (lead.whatsapp || lead.phone || '').replace(/\D/g, '')

          return (
            <div key={lead.id}
              className={`bg-white rounded-2xl p-4 border mb-3 ${
                isFollowup ? 'border-amber-300' : 'border-gray-100'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {isFollowup && (
                    <p className="text-xs text-amber-600 font-medium mb-1"><i className="ti ti-clock" aria-hidden="true" /> Follow-up inahitajika</p>
                  )}
                  <p className="font-semibold text-gray-900">{lead.business_name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {lead.phone}
                    {lead.region && ` · ${lead.region}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {SOURCE_LABELS[lead.source || ''] || lead.source || ''}
                    {lead.contact_attempts ? ` · ${lead.contact_attempts}x calls` : ''}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 ${stage.badgeClass}`}>
                  <><i className={`ti ti-${stage.icon}`} aria-hidden="true" /> {stage.label}</>
                </span>
              </div>

              {/* Contact */}
              <div className="flex gap-2 mb-2">
                {phoneForWA && (
                  <a
                    href={`https://wa.me/${phoneForWA}?text=${encodeURIComponent(
                      'Habari! Ninawasiliana nawe kutoka NyumbaFasta Tanzania. Tungependa kukukaribisha kujiunga nasi kama dalali. Je, una dakika kuzungumza?'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-[#25D366] text-white text-xs py-2 rounded-xl text-center font-medium"
                  >
                    <i className="ti ti-brand-whatsapp" aria-hidden="true" /> WhatsApp
                  </a>
                )}
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex-1 bg-blue-500 text-white text-xs py-2 rounded-xl text-center font-medium"
                  >
                    <i className="ti ti-phone" aria-hidden="true" /> Piga Simu
                  </a>
                )}
              </div>

              {/* Stage update */}
              <select
                value={lead.pipeline_stage}
                onChange={e => updateStage(lead.id, e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
              >
                {PIPELINE_STAGES.map(s => (
                  <option key={s.key} value={s.key}>
                    <><i className={`ti ti-${s.icon}`} aria-hidden="true" /> {s.label}</>
                  </option>
                ))}
              </select>

              {lead.notes && (
                <p className="text-xs text-gray-400 mt-2 line-clamp-2"><i className="ti ti-note" aria-hidden="true" /> {lead.notes}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
