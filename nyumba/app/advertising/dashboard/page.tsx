import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Image from 'next/image'

const STATUS_LABELS: Record<string, { label: string; cls: string; dot: string }> = {
  pending_review: { label: 'Inasubiri Ukaguzi', cls: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-400' },
  approved:       { label: 'Imeidhinishwa',     cls: 'bg-blue-100 text-blue-700 border-blue-200',     dot: 'bg-blue-400'  },
  active:         { label: 'Inafanya Kazi',      cls: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-400' },
  rejected:       { label: 'Imekataliwa',        cls: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-400'   },
  expired:        { label: 'Imekwisha',          cls: 'bg-gray-100 text-gray-500 border-gray-200',    dot: 'bg-gray-400'  },
  suspended:      { label: 'Imesimamishwa',      cls: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-400'   },
}

const TYPE_ICONS: Record<string, string> = {
  banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐', directory: '🏪', bundle: '📦',
}

export default async function AdvertiserDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/advertising/login')

  const admin = createAdminClient()
  const { data: advertiser } = await admin
    .from('advertisers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!advertiser) redirect('/advertising/register')

  const { data: campaigns } = await admin
    .from('ad_campaigns')
    .select(`
      *,
      plan:plan_id (name, price_tzs, duration_days),
      creative:creative_id (banner_url, video_thumb_url, processing_status)
    `)
    .eq('advertiser_id', advertiser.id)
    .order('created_at', { ascending: false })

  const active  = campaigns?.filter(c => c.status === 'active').length ?? 0
  const pending = campaigns?.filter(c => ['pending_review','approved'].includes(c.status)).length ?? 0
  const expired = campaigns?.filter(c => c.status === 'expired').length ?? 0
  const total   = campaigns?.length ?? 0

  const advertiserStatus = advertiser.status as string
  const isActive = advertiserStatus === 'active'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* Business header */}
      <div className={`px-4 pt-5 pb-4 ${
        advertiserStatus === 'active'         ? 'bg-gradient-to-r from-[#063d2d] to-primary-600'
        : advertiserStatus === 'pending_review' ? 'bg-gradient-to-r from-amber-700 to-amber-500'
        : 'bg-gradient-to-r from-gray-700 to-gray-600'
      } text-white`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{advertiser.business_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-black/20 text-white/90'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-300' : 'bg-amber-300'}`} />
                  {isActive ? 'Akaunti Idhinishwa' : advertiserStatus === 'pending_review' ? 'Inasubiri Idhini' : 'Imekataliwa'}
                </span>
                <span className="text-white/70 text-xs">{advertiser.city}</span>
              </div>
            </div>
            <Link
              href="/advertising/profile"
              className="bg-white/15 hover:bg-white/25 transition text-white text-xs font-medium px-3 py-2 rounded-xl flex-shrink-0"
            >
              ✏️ Wasifu
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">

        {/* Status banners */}
        {advertiserStatus === 'pending_review' && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-start gap-2.5">
            <span className="text-lg flex-shrink-0">⏳</span>
            <div>
              <strong>Akaunti inasubiri ukaguzi.</strong>
              <p className="text-amber-700 text-xs mt-0.5">
                Utapokea ujumbe wa WhatsApp baada ya kukaguliwa — hadi saa 24.
              </p>
            </div>
          </div>
        )}

        {advertiser.status === 'rejected' && advertiser.rejection_reason && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-800 flex items-start gap-2.5">
            <span className="text-lg flex-shrink-0">❌</span>
            <div>
              <strong>Akaunti ilikataliwa.</strong>
              <p className="text-xs mt-0.5 text-red-700">Sababu: {advertiser.rejection_reason}</p>
            </div>
          </div>
        )}

        {!advertiser.whatsapp_number && (
          <div className="mt-4 bg-red-50 border border-red-300 rounded-xl p-3.5 text-sm text-red-800 flex items-start gap-2.5">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <strong>Nambari ya WhatsApp haijawekwa!</strong>
              <p className="mt-0.5 text-xs text-red-700">Wateja hawataweza kukufikia kupitia matangazo yako.</p>
              <Link
                href="/advertising/profile"
                className="inline-block mt-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
              >
                + Ongeza WhatsApp →
              </Link>
            </div>
          </div>
        )}

        {/* Stats grid — 2×2 on mobile, 4 cols on sm+ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Jumla',         value: total,   color: 'text-gray-800',   bg: 'bg-white' },
            { label: 'Zinafanya Kazi',value: active,  color: 'text-green-600',  bg: 'bg-white' },
            { label: 'Zinasubiri',    value: pending, color: 'text-amber-600',  bg: 'bg-white' },
            { label: 'Zimekwisha',    value: expired, color: 'text-gray-400',   bg: 'bg-white' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center shadow-sm border border-gray-100`}>
              <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Analytics shortcut */}
        <Link
          href="/advertising/analytics"
          className="mt-4 flex items-center justify-between bg-white border border-primary-100 rounded-2xl px-4 py-3.5 shadow-sm hover:bg-primary-50 transition"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-bold text-gray-800 text-sm">Angalia Analytics</p>
              <p className="text-xs text-gray-400">Maoni, clicks, na CTR ya matangazo yako</p>
            </div>
          </div>
          <span className="text-gray-400 text-lg flex-shrink-0">→</span>
        </Link>

        {/* New campaign CTA */}
        <Link
          href="/advertising/new"
          className="mt-4 flex items-center gap-3 bg-primary-500 hover:bg-primary-600 transition text-white rounded-2xl px-4 py-4 shadow-sm"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            📢
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm">Unda Tangazo Jipya</div>
            <div className="text-xs text-primary-200">Chagua mpango na uanze kuonekana leo</div>
          </div>
          <span className="text-white/70 text-lg">›</span>
        </Link>

        {/* Campaign list */}
        <div className="mt-6">
          <h2 className="text-base font-bold text-gray-800 mb-3">Kampeni Zangu</h2>

          {(!campaigns || campaigns.length === 0) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <div className="text-4xl mb-3">📢</div>
              <h3 className="font-bold text-gray-700 mb-1">Bado Huna Kampeni</h3>
              <p className="text-sm text-gray-500 mb-5">Anza kuweka tangazo lako la kwanza leo.</p>
              <Link
                href="/advertising/new"
                className="inline-block bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-600 transition"
              >
                Unda Kampeni
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {(campaigns ?? []).map(c => {
              const st        = STATUS_LABELS[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-500 border-gray-200', dot: 'bg-gray-400' }
              const plan      = c.plan as { name: string; price_tzs: number; duration_days: number } | null
              const creative  = c.creative as { banner_url: string | null; video_thumb_url: string | null; processing_status: string } | null
              const needsPay  = c.status === 'approved' && c.payment_status !== 'completed'
              const needsArt  = !creative && !['rejected', 'expired', 'suspended'].includes(c.status)
              const thumb     = creative?.banner_url ?? creative?.video_thumb_url ?? null

              return (
                <div key={c.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                  needsPay ? 'border-primary-300' : needsArt ? 'border-amber-200' : 'border-gray-100'
                }`}>
                  {/* Top coloured bar */}
                  {(needsPay || needsArt) && (
                    <div className={`h-1 ${needsPay ? 'bg-primary-400' : 'bg-amber-400'}`} />
                  )}

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {thumb ? (
                          <Image src={thumb} alt={c.title} width={48} height={48} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-xl">{TYPE_ICONS[c.ad_type] ?? '📢'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 text-sm truncate">{c.title}</h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {c.target_region}
                          </span>
                        </div>
                        {plan && (
                          <p className="text-[11px] text-gray-400 mt-1">
                            {plan.name} · TZS {plan.price_tzs.toLocaleString()} · Siku {plan.duration_days}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alerts */}
                    {c.admin_note && c.status === 'rejected' && (
                      <div className="mt-3 text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">
                        <strong>Sababu ya kukataliwa:</strong> {c.admin_note}
                      </div>
                    )}
                    {needsArt && (
                      <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                        📸 Bado hujapakia picha au video ya tangazo hili.
                      </div>
                    )}

                    {/* Actions */}
                    {(needsPay || needsArt || c.status === 'rejected') && (
                      <div className="flex gap-2 mt-3">
                        {needsPay && (
                          <Link
                            href={`/advertising/pay/${c.id}`}
                            className="flex-1 text-center bg-primary-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-primary-600 transition"
                          >
                            💳 Lipa Sasa
                          </Link>
                        )}
                        {needsArt && (
                          <Link
                            href={`/advertising/campaigns/${c.id}/creative`}
                            className="flex-1 text-center bg-amber-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-amber-600 transition"
                          >
                            📸 Pakia Creative
                          </Link>
                        )}
                        {c.status === 'rejected' && (
                          <Link
                            href={`/advertising/campaigns/${c.id}/edit`}
                            className="flex-1 text-center bg-red-600 text-white text-xs font-bold px-3 py-2.5 rounded-xl hover:bg-red-700 transition"
                          >
                            ✏️ Rekebisha na Wasilisha Tena
                          </Link>
                        )}
                      </div>
                    )}

                    {c.expires_at && c.status === 'active' && (
                      <p className="text-[11px] text-gray-400 mt-2">
                        Linakwisha: {new Date(c.expires_at).toLocaleDateString('sw-TZ')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Mobile FAB */}
      <Link
        href="/advertising/new"
        className="fixed bottom-6 right-4 sm:hidden bg-primary-500 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg hover:bg-primary-600 transition text-2xl z-50"
        aria-label="Tangazo Jipya"
      >
        +
      </Link>
    </div>
  )
}
