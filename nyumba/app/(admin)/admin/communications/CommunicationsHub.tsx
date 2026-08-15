'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'

// ── Dynamic imports (all client components, ssr off) ──────────────────────────

const WhatsAppPanel   = dynamic(() => import('../whatsapp/WhatsAppPanel'),                     { ssr: false, loading: () => <HubLoader /> })
const BroadcastClient = dynamic(() => import('../whatsapp/broadcast/BroadcastClient'),          { ssr: false, loading: () => <HubLoader /> })
const MessagesPanel   = dynamic(() => import('../messages/MessagesPanel'),                      { ssr: false, loading: () => <HubLoader /> })
const NotifPage       = dynamic(() => import('../notifications/page'),                          { ssr: false, loading: () => <HubLoader /> })
const EmailClient     = dynamic(() => import('../email/EmailClient'),                           { ssr: false, loading: () => <HubLoader /> })
const KnowledgePage   = dynamic(() => import('../knowledge/page'),                              { ssr: false, loading: () => <HubLoader /> })

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'whatsapp' | 'wa_broadcast' | 'messages' | 'notifs' | 'email' | 'knowledge'

interface Props {
  userId:     string
  userName:   string
  userAvatar: string | null
  senderName: string
}

// ── Sidebar groups ────────────────────────────────────────────────────────────

const GROUPS: { title: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    title: 'WhatsApp',
    items: [
      { id: 'whatsapp',     label: 'Mazungumzo',     icon: 'brand-whatsapp' },
      { id: 'wa_broadcast', label: 'Broadcast WA',   icon: 'speakerphone'   },
    ],
  },
  {
    title: 'Ujumbe wa Ndani',
    items: [
      { id: 'messages', label: 'Mazungumzo ya Ndani', icon: 'message-2' },
      { id: 'notifs',   label: 'Taarifa za App',      icon: 'bell'      },
    ],
  },
  {
    title: 'Mengine',
    items: [
      { id: 'email',     label: 'Barua Pepe',       icon: 'mail'  },
      { id: 'knowledge', label: 'Maarifa ya Amina', icon: 'brain' },
    ],
  },
]

// ── Helper: loading skeleton ──────────────────────────────────────────────────

function HubLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-full" style={{ background: '#f4f4f0' }}>
      <span className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#1D9E75', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ── Scrollable wrapper for non-panel content ──────────────────────────────────

function ScrollPane({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto" style={{ background: '#f4f4f0' }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommunicationsHub({ userId, userName, userAvatar, senderName }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('whatsapp')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const allItems = GROUPS.flatMap(g => g.items)

  return (
    <div className="h-full flex" style={{ background: '#f4f4f0' }}>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 flex flex-col shadow-2xl overflow-hidden"
               style={{ background: '#1a1a18' }}>
            <div className="px-5 py-4 border-b flex-shrink-0 flex items-center justify-between"
                 style={{ borderColor: '#2a2a28' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1D9E75' }}>
                  <i className="ti ti-messages text-white text-sm" aria-hidden="true" />
                </div>
                <p className="font-bold text-white text-sm">Mawasiliano</p>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="p-1.5 rounded-lg" style={{ color: '#999992' }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {GROUPS.map(group => (
                <div key={group.title}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: '#666660' }}>{group.title}</p>
                  {group.items.map(item => {
                    const active = activeTab === item.id
                    return (
                      <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileNavOpen(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 text-left"
                        style={active ? { background: '#1D9E75', color: '#ffffff' } : { color: '#b0b0aa' }}>
                        <i className={`ti ti-${item.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />
                        <span>{item.label}</span>
                        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
            <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: '#2a2a28' }}>
              <a href="/admin" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm" style={{ color: '#b0b0aa' }}>
                <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
                <span>Admin Panel</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Left sidebar (desktop) ── */}
      <aside
        className="hidden lg:flex flex-col w-56 xl:w-64 flex-shrink-0 border-r overflow-y-auto"
        style={{ background: '#1a1a18', borderColor: '#2a2a28' }}
      >
        {/* Hub branding */}
        <div className="px-5 py-4 border-b flex-shrink-0" style={{ borderColor: '#2a2a28' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#1D9E75' }}>
              <i className="ti ti-messages text-white text-base" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">Mawasiliano</p>
              <p className="text-[10px]" style={{ color: '#666660' }}>Communication Hub</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-[10px] font-semibold uppercase tracking-wider px-2 mb-1.5" style={{ color: '#666660' }}>
                {group.title}
              </p>
              {group.items.map(item => {
                const active = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 text-left"
                    style={active
                      ? { background: '#1D9E75', color: '#ffffff' }
                      : { color: '#b0b0aa' }
                    }
                  >
                    <i className={`ti ti-${item.icon} text-base w-5 text-center flex-shrink-0`} aria-hidden="true" />
                    <span>{item.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Mobile topbar */}
        <div
          className="lg:hidden flex items-center gap-1 px-2 py-2 border-b flex-shrink-0"
          style={{ background: '#1a1a18', borderColor: '#2a2a28' }}
        >
          <button onClick={() => setMobileNavOpen(true)}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: '#2a2a28', color: '#b0b0aa' }}
            aria-label="Fungua menyu">
            <i className="ti ti-layout-sidebar text-sm" aria-hidden="true" />
          </button>
          <a href="/admin" className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
             style={{ color: '#b0b0aa' }} aria-label="Rudi Admin">
            <i className="ti ti-arrow-left text-sm" aria-hidden="true" />
          </a>
          <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-1 min-w-max">
              {allItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
                  style={activeTab === item.id ? { background: '#1D9E75', color: '#fff' } : { color: '#b0b0aa' }}>
                  <i className={`ti ti-${item.icon}`} aria-hidden="true" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Panel content — each component manages its own scroll/height */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'whatsapp' && <WhatsAppPanel />}

          {activeTab === 'wa_broadcast' && (
            <ScrollPane><BroadcastClient /></ScrollPane>
          )}

          {activeTab === 'messages' && (
            <MessagesPanel
              currentUserId={userId}
              currentUserName={userName}
              currentUserAvatar={userAvatar}
            />
          )}

          {activeTab === 'notifs' && (
            <ScrollPane><NotifPage /></ScrollPane>
          )}

          {activeTab === 'email' && (
            <ScrollPane><EmailClient senderName={senderName} /></ScrollPane>
          )}

          {activeTab === 'knowledge' && (
            <ScrollPane><KnowledgePage /></ScrollPane>
          )}
        </div>
      </div>
    </div>
  )
}
