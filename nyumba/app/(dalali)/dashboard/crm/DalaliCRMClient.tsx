'use client'
// Dalali do NOT manage agent_leads.
// agent_leads = prospective dalali (people to RECRUIT onto NyumbaFasta).
// They are managed by internal STAFF, not by existing dalali.
//
// This page was previously showing agent_leads to dalali — that was wrong.
// Dalali's CRM is their LISTING activity: contacts unlocked, views, reviews.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type UnlockContact = {
  id: string
  created_at: string
  listing: { title: string; region: string } | null
  client: { full_name: string; phone: string } | null
}

export default function DalaliCRMClient() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<UnlockContact[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total_unlocks: 0, this_month: 0 })
  const [hasMore, setHasMore] = useState(false)

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const PAGE = 50
    const [all, month, total] = await Promise.all([
      supabase.from('contact_unlocks')
        .select(`
          id, created_at,
          listing:listing_id(title, region),
          client:client_id(full_name, phone)
        `)
        .eq('dalali_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE),
      supabase.from('contact_unlocks')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id)
        .gte('created_at', startOfMonth.toISOString()),
      supabase.from('contact_unlocks')
        .select('id', { count: 'exact', head: true })
        .eq('dalali_id', user.id),
    ])

    const totalCount = total.count ?? 0
    setContacts((all.data as unknown as UnlockContact[]) || [])
    setHasMore(totalCount > PAGE)
    setStats({ total_unlocks: totalCount, this_month: month.count ?? 0 })
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-[#1D9E75] px-4 py-4 sticky top-0 z-10">
        <h1 className="text-white font-bold text-lg mb-3">📊 Wateja Waliofungua</h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-2xl">{stats.total_unlocks}</div>
            <div className="text-green-100 text-xs">Jumla ya Ufunguzi</div>
          </div>
          <div className="bg-white/20 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-2xl">{stats.this_month}</div>
            <div className="text-green-100 text-xs">Mwezi Huu</div>
          </div>
        </div>
      </header>

      <div className="px-4 py-4">
        <p className="text-xs text-gray-500 mb-4">
          Hawa ni wateja waliofungua nambari yako ya mawasiliano kupitia NyumbaFasta.
          {hasMore && (
            <span className="ml-1 text-amber-600 font-medium">
              (Inaonyesha 50 za hivi karibuni)
            </span>
          )}
        </p>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-20 animate-pulse mb-3" />
          ))
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 font-medium">Hakuna wateja bado</p>
            <p className="text-gray-400 text-sm mt-1">
              Wateja wataonekana hapa baada ya kufungua mawasiliano yako
            </p>
          </div>
        ) : contacts.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100 mb-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {c.client?.full_name || 'Mteja'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  🏠 {c.listing?.title} · 📍 {c.listing?.region}
                </p>
                <p className="text-xs text-gray-400">
                  📅 {new Date(c.created_at).toLocaleDateString('sw-TZ')}
                </p>
              </div>
              {c.client?.phone && (
                <a href={`https://wa.me/${c.client.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="bg-[#25D366] text-white text-xs px-3 py-2 rounded-xl font-medium flex-shrink-0">
                  💬 WA
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
