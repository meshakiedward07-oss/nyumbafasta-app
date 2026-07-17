// All staff-accessible modules and role templates.
// Routes point to /admin/* because that's where all dashboards live.

export const STAFF_PERMISSIONS = {
  // ── CRM / Leads ─────────────────────────────────────────────
  leads: {
    key: 'leads',
    label: 'Leads za Madalali',
    description: 'Kuwasiliana na madalali watarajiwa, kuwafuatilia hadi wajisajili',
    adminPath: '/admin/staff-leads',
    icon: 'target',
    category: 'crm' as const,
  },
  lead_scraper: {
    key: 'lead_scraper',
    label: 'Lead Scraper',
    description: 'Kuendesha scraping ya madalali wapya, kuona leads zote',
    adminPath: '/admin/leads',
    icon: 'robot',
    category: 'crm' as const,
  },
  listing_analytics: {
    key: 'listing_analytics',
    label: 'Listing Analytics',
    description: 'Kuangalia listings zenye performance ndogo, CRM analytics',
    adminPath: '/admin/crm/analytics',
    icon: 'chart-bar',
    category: 'crm' as const,
  },
  // ── Support ──────────────────────────────────────────────────
  whatsapp_support: {
    key: 'whatsapp_support',
    label: 'WhatsApp Support',
    description: 'Kuchukua mazungumzo ambayo Amina ameshindwa kusaidia',
    adminPath: '/admin/whatsapp',
    icon: 'message-circle',
    category: 'support' as const,
  },
  legal_violations: {
    key: 'legal_violations',
    label: 'Malalamiko na Ukiukaji',
    description: 'Kuchunguza ripoti za utapeli/ukiukaji wa masharti',
    adminPath: '/admin/legal',
    icon: 'scale',
    category: 'support' as const,
  },
  // ── Content ──────────────────────────────────────────────────
  social_media: {
    key: 'social_media',
    label: 'Social Media',
    description: 'Kupakia content, kujibu comments/DMs, kusimamia Facebook Groups',
    adminPath: '/admin/social',
    icon: 'brand-instagram',
    category: 'content' as const,
  },
  spam_moderation: {
    key: 'spam_moderation',
    label: 'Spam Moderation',
    description: 'Kuangalia comments zilizoflagiwa, kuamua zifutwe au la',
    adminPath: '/admin/social',
    icon: 'ban',
    category: 'content' as const,
  },
  // ── Admin Tasks (Platform Operations) ───────────────────────
  approve_listings: {
    key: 'approve_listings',
    label: 'Idhinisha Matangazo',
    description: 'Angalia na uidhinishe au kataa listings zinazongoja idhini',
    adminPath: '/admin/staff-dashboard',
    icon: 'home-check',
    category: 'admin' as const,
  },
  manage_users: {
    key: 'manage_users',
    label: 'Simamia Watumiaji',
    description: 'Angalia na simamia akaunti za madalali na wateja (futa, simamisha, rudisha)',
    adminPath: '/admin/staff-dashboard',
    icon: 'users-group',
    category: 'admin' as const,
  },
  handle_reports: {
    key: 'handle_reports',
    label: 'Ripoti za Malalamiko',
    description: 'Angalia na shughulikia ripoti za ukiukaji na malalamiko kutoka kwa wateja',
    adminPath: '/admin/staff-dashboard',
    icon: 'flag',
    category: 'admin' as const,
  },
  manage_subscriptions: {
    key: 'manage_subscriptions',
    label: 'Simamia Usajili',
    description: 'Angalia usajili wa madalali, ongeza muda, simamisha, au rudisha',
    adminPath: '/admin/staff-dashboard',
    icon: 'credit-card',
    category: 'admin' as const,
  },
  manage_verifications: {
    key: 'manage_verifications',
    label: 'Thibitisha Madalali',
    description: 'Angalia maombi ya uthibitisho wa NIDA na uidhinishe au kataa',
    adminPath: '/admin/staff-dashboard',
    icon: 'id-badge',
    category: 'admin' as const,
  },
  review_ads: {
    key: 'review_ads',
    label: 'Ukaguzi wa Matangazo',
    description: 'Angalia, uidhinishe, au kataa kampeni za matangazo zilizopelekwa na waadvertiser',
    adminPath: '/admin/staff-dashboard',
    icon: 'speakerphone',
    category: 'admin' as const,
  },
} as const

export type PermissionKey = keyof typeof STAFF_PERMISSIONS

// ── Permission categories for UI grouping ──────────────────────────────────
export const ADMIN_TASK_PERMISSIONS: PermissionKey[] = [
  'approve_listings', 'manage_users', 'handle_reports',
  'manage_subscriptions', 'manage_verifications', 'review_ads',
]

// Pre-built templates — admin can still customise per-person
export const STAFF_ROLE_TEMPLATES = {
  sales_agent: {
    label: 'Sales Agent',
    permissions: ['leads'] as PermissionKey[],
  },
  onboarding_specialist: {
    label: 'Onboarding Specialist',
    permissions: ['leads', 'lead_scraper'] as PermissionKey[],
  },
  customer_support: {
    label: 'Customer Support',
    permissions: ['whatsapp_support', 'legal_violations', 'handle_reports'] as PermissionKey[],
  },
  social_media_manager: {
    label: 'Social Media Manager',
    permissions: ['social_media', 'spam_moderation'] as PermissionKey[],
  },
  listings_agent: {
    label: 'Listings Moderator',
    permissions: ['approve_listings', 'manage_verifications'] as PermissionKey[],
  },
  user_support: {
    label: 'User Support Specialist',
    permissions: ['manage_users', 'handle_reports', 'whatsapp_support', 'manage_subscriptions'] as PermissionKey[],
  },
  quality_control: {
    label: 'Quality Control',
    permissions: ['spam_moderation', 'legal_violations', 'listing_analytics', 'handle_reports'] as PermissionKey[],
  },
  platform_manager: {
    label: 'Platform Manager',
    permissions: [
      'approve_listings', 'manage_users', 'handle_reports',
      'manage_subscriptions', 'manage_verifications', 'legal_violations', 'review_ads',
    ] as PermissionKey[],
  },
  ads_moderator: {
    label: 'Ads Moderator',
    permissions: ['review_ads'] as PermissionKey[],
  },
  team_lead: {
    label: 'Team Lead (Full Access)',
    permissions: [
      'leads', 'whatsapp_support', 'social_media', 'legal_violations',
      'lead_scraper', 'listing_analytics', 'spam_moderation',
      'approve_listings', 'manage_users', 'handle_reports',
      'manage_subscriptions', 'manage_verifications', 'review_ads',
    ] as PermissionKey[],
  },
} as const

export type RoleTemplate = keyof typeof STAFF_ROLE_TEMPLATES

// Map admin route prefixes → required permission key (for nav filtering)
export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey> = {
  '/admin/staff-leads':     'leads',
  '/admin/whatsapp':        'whatsapp_support',
  '/admin/social':          'social_media',
  '/admin/legal':           'legal_violations',
  '/admin/leads':           'lead_scraper',
  '/admin/crm/analytics':   'listing_analytics',
  '/admin/adverts':         'review_ads',
}
