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

  const allItems = GROUPS.flatMap(g => g.items)

  return (
    <div className="h-full flex" style={{ background: '#f4f4f0' }}>

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

        {/* Mobile tab bar */}
        <div
          className="lg:hidden flex items-center gap-1 px-3 py-2 border-b overflow-x-auto flex-shrink-0"
          style={{ background: '#1a1a18', borderColor: '#2a2a28' }}
        >
          {allItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={activeTab === item.id
                ? { background: '#1D9E75', color: '#fff' }
                : { color: '#b0b0aa' }
              }
            >
              <i className={`ti ti-${item.icon}`} aria-hidden="true" />
              {item.label}
            </button>
          ))}
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
