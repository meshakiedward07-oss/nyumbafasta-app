import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import Image from 'next/image'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'Inasubiri Ukaguzi', cls: 'bg-amber-100 text-amber-700' },
  approved:       { label: 'Imeidhinishwa',     cls: 'bg-blue-100 text-blue-700'   },
  active:         { label: 'Inafanya Kazi',      cls: 'bg-green-100 text-green-700' },
  rejected:       { label: 'Imekataliwa',        cls: 'bg-red-100 text-red-700'     },
  expired:        { label: 'Imekwisha',          cls: 'bg-gray-100 text-gray-500'   },
  suspended:      { label: 'Imesimamishwa',      cls: 'bg-red-100 text-red-700'     },
}

const PAYMENT_LABELS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Malipo Yasubiri', cls: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Imelipwa',        cls: 'bg-green-100 text-green-700' },
  failed:    { label: 'Malipo Yameshindwa', cls: 'bg-red-100 text-red-700'  },
}

const TYPE_ICONS: Record<string, string> = {
  banner: '🎯', search: '🔍', nearby: '📍', video: '🎬', featured: '⭐',
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

  const stats = {
    total:   campaigns?.length ?? 0,
    active:  campaigns?.filter(c => c.status === 'active').length ?? 0,
    pending: campaigns?.filter(c => c.status === 'pending_review' || c.status === 'approved').length ?? 0,
    expired: campaigns?.filter(c => c.status === 'expired').length ?? 0,
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{advertiser.business_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              advertiser.status === 'active' ? 'bg-green-100 text-green-700' :
              advertiser.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {advertiser.status === 'active' ? '✓ Akaunti Idhinishwa' :
               advertiser.status === 'pending_review' ? '⏳ Inasubiri Idhini' :
               '✗ Imekataliwa'}
            </span>
            <span className="text-sm text-gray-400">{advertiser.city}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/advertising/profile"
            className="border border-gray-300 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            ✏️ Wasifu
          </Link>
          <Link
            href="/advertising/new"
            className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary-600 transition"
          >
            + Tangazo Jipya
          </Link>
        </div>
      </div>

      {/* Status banner for pending */}
      {advertiser.status === 'pending_review' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <strong>Akaunti yako inasubiri ukaguzi wa admin.</strong> Utapokea ujumbe wa WhatsApp
          baada ya kukaguliwa. Hii inachukua hadi saa 24.
        </div>
      )}

      {/* Missing WhatsApp warning — clicks will go nowhere without it */}
      {!advertiser.whatsapp_number && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6 text-sm text-red-800 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div>
            <strong>Nambari ya WhatsApp haijawekwa!</strong>
            <p className="mt-1 text-red-700">Wateja wanaobonyeza matangazo yako hawataweza kukufikia. Ongeza nambari yako ya WhatsApp mara moja.</p>
            <a
              href="/advertising/profile"
              className="inline-block mt-2 bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700 transition"
            >
              + Ongeza WhatsApp →
            </a>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Jumla', value: stats.total, color: 'text-gray-800' },
          { label: 'Zinafanya Kazi', value: stats.active, color: 'text-green-600' },
          { label: 'Zinasubiri', value: stats.pending, color: 'text-amber-600' },
          { label: 'Zimekwisha', value: stats.expired, color: 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div>
        <h2 className="text-lg font-bold text-gray-700 mb-4">Kampeni Zangu</h2>

        {(!campaigns || campaigns.length === 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <div className="text-4xl mb-3">📢</div>
            <h3 className="font-bold text-gray-700 mb-2">Bado Huna Kampeni</h3>
            <p className="text-sm text-gray-500 mb-4">Anza kuweka tangazo lako la kwanza leo.</p>
            <Link
              href="/advertising/new"
              className="inline-block bg-primary-500 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-primary-600 transition"
            >
              Unda Kampeni
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {(campaigns ?? []).map(c => {
            const st = STATUS_LABELS[c.status] ?? { label: c.status, cls: 'bg-gray-100 text-gray-500' }
            const pt = PAYMENT_LABELS[c.payment_status] ?? { label: c.payment_status, cls: 'bg-gray-100 text-gray-500' }
            const plan = c.plan as { name: string; price_tzs: number; duration_days: number } | null
            const creative = c.creative as { banner_url: string | null; video_thumb_url: string | null; processing_status: string } | null
            const needsPayment   = c.status === 'approved' && c.payment_status !== 'completed'
            const needsCreative  = !creative && !['rejected', 'expired', 'suspended'].includes(c.status)
            const thumb          = creative?.banner_url ?? creative?.video_thumb_url ?? null

            return (
              <div key={c.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${
                needsPayment ? 'border-primary-300' : needsCreative ? 'border-amber-200' : 'border-gray-100'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Thumbnail preview if creative exists */}
                  {thumb && (
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <Image src={thumb} alt={c.title} fill className="object-cover" sizes="56px" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{TYPE_ICONS[c.ad_type] ?? '📢'}</span>
                      <h3 className="font-bold text-gray-800 truncate">{c.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pt.cls}`}>
                        {pt.label}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {c.target_region}
                      </span>
                    </div>
                    {plan && (
                      <p className="text-xs text-gray-400">
                        {plan.name} · TZS {plan.price_tzs.toLocaleString()} · Siku {plan.duration_days}
                      </p>
                    )}
                    {c.expires_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Linakwisha: {new Date(c.expires_at).toLocaleDateString('sw-TZ')}
                      </p>
                    )}
                    {c.admin_note && c.status === 'rejected' && (
                      <p className="text-xs text-red-600 mt-1 bg-red-50 rounded-lg px-2 py-1">
                        Sababu: {c.admin_note}
                      </p>
                    )}
                    {needsCreative && (
                      <p className="text-xs text-amber-700 mt-1 bg-amber-50 rounded-lg px-2 py-1">
                        📸 Bado hujapakia picha/video ya tangazo hili.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 items-end flex-shrink-0">
                    {needsPayment && (
                      <Link
                        href={`/advertising/pay/${c.id}`}
                        className="bg-primary-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary-600 transition whitespace-nowrap"
                      >
                        💳 Lipa Sasa
                      </Link>
                    )}
                    {needsCreative && (
                      <Link
                        href={`/advertising/campaigns/${c.id}/creative`}
                        className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-amber-600 transition whitespace-nowrap"
                      >
                        📸 Pakia Creative
                      </Link>
                    )}
                    {c.payment_status === 'pending' && c.status === 'pending_review' && (
                      <Link
                        href={`/advertising/pay/${c.id}`}
                        className="border border-gray-300 text-gray-600 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50 transition whitespace-nowrap"
                      >
                        Lipa Baadaye
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
