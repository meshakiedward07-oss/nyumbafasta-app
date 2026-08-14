// Phase 2B — Dalali sub-pages and components
// Namespace prefix: dl_ (dalali pages)
// Files: app/(dalali)/dashboard/**/*.tsx, components/dalali/**/*.tsx
const T_dalaliPages = {
  // ── DashboardClient — shortcut card strings ─────────────────────────────────
  dl_my_ads_title:         { sw: 'Matangazo Yangu',  en: 'My Listings'   },
  dl_listing_singular:     { sw: 'tangazo',           en: 'listing'       },
  dl_listing_active_unit:  { sw: 'yanafanya kazi',    en: 'active'        },
  dl_listing_pending_unit: { sw: 'yanasubiri',        en: 'pending'       },
} as const

export default T_dalaliPages
