'use client'
import { useState } from 'react'

type JobResult = { success?: boolean; error?: string; message?: string; [key: string]: unknown }

type Job = {
  id: string
  name: string
  description: string
  schedule: string
  endpoint: string
  method: 'POST' | 'GET'
  body?: Record<string, unknown>
  icon: string
  color: string
}

const JOBS: Job[] = [
  {
    id:          'daily',
    name:        'Kazi za Kila Siku',
    description: 'Subscription reminders, listing expiry checks, lead follow-ups, WA renewal alerts',
    schedule:    'Kila siku saa 9 asubuhi',
    endpoint:    '/api/v1/admin/run-cron',
    method:      'POST',
    body:        { cron: 'daily' },
    icon:        'calendar-event',
    color:       'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    id:          'weekly',
    name:        'Kazi za Kila Wiki',
    description: 'Weekly performance reports, inactive dalali cleanup, summary emails',
    schedule:    'Jumamosi saa 11 usiku',
    endpoint:    '/api/v1/admin/run-cron',
    method:      'POST',
    body:        { cron: 'weekly' },
    icon:        'calendar-week',
    color:       'text-purple-600 bg-purple-50 border-purple-200',
  },
  {
    id:          'hourly',
    name:        'Kazi za Kila Saa',
    description: 'Subscription grace period checks, payment reconciliation, quick syncs',
    schedule:    'Kila saa (4 asubuhi)',
    endpoint:    '/api/v1/admin/run-cron',
    method:      'POST',
    body:        { cron: 'hourly' },
    icon:        'clock',
    color:       'text-sky-600 bg-sky-50 border-sky-200',
  },
  {
    id:          'lease-payments',
    name:        'Malipo ya Pango (Kila Mwezi)',
    description: 'Creates monthly rent payment records for all active leases in property-management orgs',
    schedule:    'Tarehe 1 kila mwezi saa 8 asubuhi',
    endpoint:    '/api/v1/cron/lease-payments',
    method:      'POST',
    icon:        'home-dollar',
    color:       'text-green-700 bg-green-50 border-green-200',
  },
  {
    id:          'recurring-expenses',
    name:        'Matumizi ya Kurudiwa (Kila Mwezi)',
    description: 'Copies recurring expense templates into actual expense records for current month',
    schedule:    'Tarehe 1 kila mwezi saa 9 asubuhi',
    endpoint:    '/api/v1/cron/recurring-expenses',
    method:      'POST',
    icon:        'repeat',
    color:       'text-orange-600 bg-orange-50 border-orange-200',
  },
  {
    id:          'broadcast',
    name:        'WhatsApp Broadcast (Kila Siku)',
    description: 'Processes scheduled WhatsApp broadcasts and sends them to target audiences',
    schedule:    'Kila siku saa 7 usiku',
    endpoint:    '/api/v1/cron/broadcast',
    method:      'POST',
    icon:        'brand-whatsapp',
    color:       'text-green-600 bg-green-50 border-green-200',
  },
  {
    id:          'social-refresh-stats',
    name:        'Social Media Stats Refresh',
    description: 'Refreshes Instagram/Facebook/TikTok post engagement stats from platform APIs',
    schedule:    'Kila siku saa 11 asubuhi',
    endpoint:    '/api/v1/cron/social/refresh-stats',
    method:      'POST',
    icon:        'chart-bar',
    color:       'text-pink-600 bg-pink-50 border-pink-200',
  },
  {
    id:          'trial-reminders',
    name:        'Vikumbusho vya Jaribio',
    description: 'Sends expiry reminder notifications to dalali whose trial subscriptions are ending soon',
    schedule:    'Inaitwa manually au via cron',
    endpoint:    '/api/v1/admin/trial-reminders',
    method:      'POST',
    icon:        'bell-ringing',
    color:       'text-amber-600 bg-amber-50 border-amber-200',
  },
]

export default function CronsPage() {
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, JobResult>>({})

  async function runJob(job: Job) {
    setRunning(job.id)
    try {
      const opts: RequestInit = { method: job.method }
      if (job.method === 'POST') {
        opts.headers = { 'Content-Type': 'application/json' }
        opts.body    = JSON.stringify(job.body ?? {})
      }
      const res  = await fetch(job.endpoint, opts)
      const data = await res.json() as JobResult
      setResults(prev => ({ ...prev, [job.id]: { ...data, _ok: res.ok } }))
    } catch (e) {
      setResults(prev => ({ ...prev, [job.id]: { error: e instanceof Error ? e.message : 'Imeshindwa' } }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Kazi za Mfumo (Cron Jobs)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Angalia na uanzishe kazi za kiotomatiki za mfumo kwa mkono</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700 leading-relaxed">
        <i className="ti ti-alert-triangle mr-1" />
        Kazi hizi zinaendesha mchakato wa kweli — tuma akaunti, tuma taarifa, na unda rekodi. Zitumie kwa uangalifu na uepuke kurudia haraka.
      </div>

      <div className="space-y-3">
        {JOBS.map(job => {
          const res = results[job.id]
          const isRunning = running === job.id
          return (
            <div key={job.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${job.color}`}>
                  <i className={`ti ti-${job.icon} text-lg`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{job.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{job.description}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        <i className="ti ti-calendar-time" /> {job.schedule}
                      </p>
                    </div>
                    <button
                      onClick={() => runJob(job)}
                      disabled={isRunning || running !== null}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold disabled:opacity-50 hover:bg-gray-700 transition-colors active:scale-95"
                    >
                      {isRunning
                        ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Inaendesha...</>
                        : <><i className="ti ti-player-play" /> Endesha</>
                      }
                    </button>
                  </div>

                  {res && (
                    <div className={`mt-3 px-3 py-2 rounded-xl text-xs leading-relaxed ${res.error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                      {res.error
                        ? <><i className="ti ti-x-circle mr-1" />{res.error}</>
                        : <><i className="ti ti-circle-check mr-1" />{res.message ?? 'Imefanikiwa'}</>
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-500 leading-relaxed">
        <p className="font-semibold text-gray-700 mb-1">Ratiba ya Cron (Vercel)</p>
        <code className="block bg-white border border-gray-200 rounded-lg p-2.5 text-gray-700 font-mono text-[11px] overflow-auto">
          {`broadcast:          0 1 * * *   (kila siku 01:00 UTC)\nlease-payments:     0 2 1 * *   (tarehe 1 02:00 UTC)\nrecurring-expenses: 0 3 1 * *   (tarehe 1 03:00 UTC)\ndaily:              0 3 * * *   (kila siku 03:00 UTC)\nweekly:             0 17 * * 6  (Jumamosi 17:00 UTC)`}
        </code>
      </div>
    </div>
  )
}
