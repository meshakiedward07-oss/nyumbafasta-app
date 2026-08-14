'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import BottomNav from '@/components/shared/BottomNav'
import type { ContactItem } from '@/app/account/contacts/page'
import { useLanguage } from '@/lib/i18n/context'
import type { TKey } from '@/lib/i18n/translations'

type Props = {
  contacts: ContactItem[]
  totalSpent: number
}

const typeLabel: Record<string, string> = {
  chumba: 'Chumba', apartment: 'Apartment', nyumba: 'Nyumba', studio: 'Studio', duka: 'Duka',
}

function timeAgo(dateStr: string, t: (k: TKey) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return t('lst_ago_today').toLowerCase()
  if (days === 1) return t('lst_ago_yesterday').toLowerCase()
  if (days < 30) return t('lst_ago_days').replace('{{n}}', String(days)).toLowerCase()
  if (days < 60) return t('lst_ago_1month').toLowerCase()
  return t('lst_ago_months').replace('{{n}}', String(Math.floor(days / 30))).toLowerCase()
}

export default function ContactHistoryClient({ contacts, totalSpent }: Props) {
  const router = useRouter()
  const { t } = useLanguage()
  const [items, setItems] = useState(contacts)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  async function saveNote(contactId: string) {
    setSavingNote(true)
    try {
      await fetch(`/api/v1/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_notes: noteText.trim() || null }),
      })
      setItems(prev => prev.map(c => c.id === contactId ? { ...c, client_notes: noteText.trim() || null } : c))
      setEditingNotes(null)
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Header */}
      <div className="bg-primary-500 px-4 pt-5 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-white/20 text-white active:scale-90 transition-transform">
            ←
          </button>
          <h1 className="text-white text-lg font-bold">{t('cl_contact_history')}</h1>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-white text-xl font-bold">{items.length}</p>
            <p className="text-white/70 text-xs">Contacts</p>
          </div>
          <div className="bg-white/10 rounded-2xl p-3 text-center">
            <p className="text-white text-xl font-bold">Tsh {totalSpent.toLocaleString()}</p>
            <p className="text-white/70 text-xs">{t('cl_spent')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
            <div className="text-4xl mb-3 flex justify-center"><i className="ti ti-message-circle text-gray-400" aria-hidden="true" /></div>
            <p className="text-sm font-semibold text-gray-600 mb-1">{t('cl_no_history')}</p>
            <p className="text-xs text-gray-400">{t('cl_no_history_sub')}</p>
          </div>
        ) : items.map(contact => {
          const dalali  = contact.dalali
          const listing = contact.listings
          const waNumber = dalali?.dalali_profiles?.whatsapp_number?.replace(/\D/g, '')
          const waUrl = waNumber ? `https://wa.me/${waNumber}` : null
          const isEditing = editingNotes === contact.id

          return (
            <div key={contact.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Listing image strip */}
              {listing?.images?.[0] && (
                <div className="relative h-28 bg-gray-100">
                  <Image fill src={listing.images[0]} alt="" className="object-cover" sizes="100vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <div className="absolute bottom-2 left-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      listing.status === 'active' ? 'bg-primary-50 text-primary-700' :
                      listing.status === 'taken' ? 'bg-amber-50 text-amber-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {listing.status === 'active' ? t('cl_available') :
                       listing.status === 'taken' ? t('cl_taken') : listing.status}
                    </span>
                  </div>
                </div>
              )}

              <div className="p-4">
                {/* Dalali + listing info */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold flex-shrink-0 text-sm">
                    {dalali?.full_name?.[0]?.toUpperCase() ?? 'D'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900">{dalali?.full_name ?? 'Dalali'}</p>
                      {dalali?.dalali_profiles?.is_premium_verified && (
                        <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"><i className="ti ti-circle-check" aria-hidden="true" />{t('lst_verified')}</span>
                      )}
                    </div>
                    {listing && (
                      <p className="text-xs text-gray-500">
                        {typeLabel[listing.type] || listing.type} — {listing.district}, {listing.region}
                      </p>
                    )}
                    {listing?.price_monthly && (
                      <p className="text-xs font-semibold text-primary-600">
                        <span suppressHydrationWarning>Tsh {listing.price_monthly.toLocaleString()}{t('lst_per_month')}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Unlock time */}
                <div className="flex items-center gap-2 mb-3">
                  <i className="ti ti-message-circle text-base" aria-hidden="true" />
                  <p className="text-xs text-gray-500">
                    {t('cl_contact_opened_at')} <span className="font-medium text-gray-700" suppressHydrationWarning>{timeAgo(contact.created_at, t)}</span>
                  </p>
                </div>

                {/* Client notes */}
                {isEditing ? (
                  <div className="mb-3 space-y-2">
                    <textarea
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder={t('cl_notes_placeholder')}
                      rows={3}
                      maxLength={500}
                      className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5
                                 focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingNotes(null); setNoteText('') }}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 font-medium">
                        {t('common_cancel')}
                      </button>
                      <button onClick={() => saveNote(contact.id)} disabled={savingNote}
                        className="flex-1 py-2 rounded-xl bg-primary-500 text-white text-xs font-semibold disabled:opacity-50">
                        {savingNote ? t('cl_saving') : t('common_save')}
                      </button>
                    </div>
                  </div>
                ) : contact.client_notes ? (
                  <div className="mb-3 bg-gray-50 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 mb-1 flex items-center gap-1"><i className="ti ti-note" aria-hidden="true" />{t('cl_your_notes')}</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{contact.client_notes}</p>
                      </div>
                      <button
                        onClick={() => { setEditingNotes(contact.id); setNoteText(contact.client_notes ?? '') }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        <i className="ti ti-pencil" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex gap-2">
                  {waUrl ? (
                    <a href={waUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                 bg-green-500 text-white text-xs font-semibold active:scale-[0.97] transition-transform">
                      <i className="ti ti-brand-whatsapp" aria-hidden="true" /> {t('cl_contact_again')}
                    </a>
                  ) : null}
                  {listing && (
                    <Link href={`/listings/${listing.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                 bg-gray-50 border border-gray-100 text-gray-600 text-xs font-medium active:scale-[0.97] transition-transform">
                      <i className="ti ti-eye" aria-hidden="true" /> {t('cl_view_listing')}
                    </Link>
                  )}
                  {!isEditing && (
                    <button
                      onClick={() => { setEditingNotes(contact.id); setNoteText(contact.client_notes ?? '') }}
                      className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-500 text-xs active:scale-[0.97] transition-transform"
                      title={t('cl_add_notes')}
                    >
                      <i className="ti ti-note" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
