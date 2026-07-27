'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import OverviewTab          from './tabs/OverviewTab'
import OrgsTab              from './tabs/OrgsTab'
import KycTab               from './tabs/KycTab'
import VendorsTab           from './tabs/VendorsTab'
import CommissionsTab       from './tabs/CommissionsTab'
import RentTab              from './tabs/RentTab'
import MaintenanceTab       from './tabs/MaintenanceTab'
import WorkloadTab          from './tabs/WorkloadTab'
import SubscriptionPlansTab from './tabs/SubscriptionPlansTab'
import BrokerageTab        from './tabs/BrokerageTab'

type Tab =
  | 'overview' | 'organizations' | 'kyc' | 'vendors'
  | 'commissions' | 'rent' | 'maintenance' | 'workload' | 'subscription_plans'
  | 'brokerage'

const SIDEBAR_GROUPS: { title: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    title: 'Muhtasari',
    items: [
      { id: 'overview', label: 'Muhtasari', icon: 'chart-bar' },
    ],
  },
  {
    title: 'Mashirika & Watu',
    items: [
      { id: 'organizations', label: 'Mashirika',        icon: 'building'  },
      { id: 'kyc',           label: 'Uthibitisho KYC',  icon: 'id'        },
      { id: 'vendors',       label: 'Mawakala',         icon: 'address-book' },
    ],
  },
  {
    title: 'Fedha',
    items: [
      { id: 'commissions', label: 'Kamisheni',       icon: 'coin'    },
      { id: 'rent',        label: 'Ukaguzi wa Kodi', icon: 'receipt' },
    ],
  },
  {
    title: 'Usimamizi',
    items: [
      { id: 'maintenance', label: 'Matengenezo Yote', icon: 'tool'  },
      { id: 'workload',    label: 'Mzigo wa Kazi',    icon: 'users' },
    ],
  },
  {
    title: 'Brokerage',
    items: [
      { id: 'brokerage', label: 'Brokerage & Kamisheni', icon: 'building-store' },
    ],
  },
  {
    title: 'Mipango',
    items: [
      { id: 'subscription_plans', label: 'Mipango ya Usajili', icon: 'list-details' },
    ],
  },
]

const ALL_NAV_ITEMS = SIDEBAR_GROUPS.flatMap(g => g.items)

export default function PropertyDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const activeTabInfo = ALL_NAV_ITEMS.find(t => t.id === activeTab)
  const router = useRouter()

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#f4f4f0' }}>

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col w-[185px] flex-shrink-0 h-full overflow-y-auto bg-white border-r"
        style={{ borderColor: '#e5e5e0' }}
      >
        {/* Brand + back link */}
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: '#e5e5e0' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#1a1a18' }}
            >
              <span className="text-white text-xs font-bold">PM</span>
            </div>
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: '#1a1a18' }}>Mali</p>
              <p className="text-[10px] leading-tight" style={{ color: '#999992' }}>NyumbaFasta</p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2 py-1.5 transition-all hover:bg-gray-100 w-full text-left"
            style={{ color: '#666660' }}
          >
            <i className="ti ti-arrow-left text-xs" aria-hidden="true" />
            Rudi Nyuma
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {SIDEBAR_GROUPS.map(group => (
            <div key={group.title} className="mb-4">
              <p
                className="text-[9px] font-bold uppercase tracking-widest px-2.5 mb-1.5"
                style={{ color: '#999992' }}
              >
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg transition-all text-left ${
                      activeTab === item.id
                        ? 'bg-primary-50 text-primary-700 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <i className={`ti ti-${item.icon} text-sm w-4 flex-shrink-0 text-center`} aria-hidden="true" />
                    <span className="text-xs truncate">{item.label}</span>
                    {activeTab === item.id && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Topbar */}
        <div
          className="bg-white border-b px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-3 flex-shrink-0"
          style={{ borderColor: '#e5e5e0' }}
        >
          <button
            onClick={() => router.back()}
            className="lg:hidden flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 active:bg-gray-200 transition"
            style={{ color: '#666660' }}
            aria-label="Rudi Nyuma"
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm lg:text-base font-bold leading-tight truncate" style={{ color: '#1a1a18' }}>
              {activeTabInfo?.label ?? 'Usimamizi wa Mali'}
            </h1>
            <p className="text-xs mt-0.5 hidden sm:block" style={{ color: '#999992' }}>
              Mashirika, KYC, kamisheni, matengenezo — NyumbaFasta
            </p>
          </div>
        </div>

        {/* Mobile scrollable tab nav */}
        <div
          className="lg:hidden flex-shrink-0 border-b overflow-x-auto bg-white"
          style={{ borderColor: '#e5e5e0', scrollbarWidth: 'none' }}
        >
          <div className="flex gap-1.5 px-3 py-2.5 min-w-max">
            {ALL_NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${
                  activeTab === item.id ? 'text-white' : 'text-gray-600'
                }`}
                style={{ background: activeTab === item.id ? '#1D9E75' : '#f4f4f0' }}
              >
                <i className={`ti ti-${item.icon} text-[11px] flex-shrink-0`} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content — only this area scrolls */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          {activeTab === 'overview'            && <OverviewTab onNavigate={setActiveTab} />}
          {activeTab === 'organizations'       && <OrgsTab />}
          {activeTab === 'kyc'                 && <KycTab />}
          {activeTab === 'vendors'             && <VendorsTab />}
          {activeTab === 'commissions'         && <CommissionsTab />}
          {activeTab === 'rent'                && <RentTab />}
          {activeTab === 'maintenance'         && <MaintenanceTab />}
          {activeTab === 'workload'            && <WorkloadTab />}
          {activeTab === 'subscription_plans'  && <SubscriptionPlansTab />}
          {activeTab === 'brokerage'            && <BrokerageTab />}
        </div>
      </div>
    </div>
  )
}
