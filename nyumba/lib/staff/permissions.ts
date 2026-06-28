// All staff-accessible modules and role templates.
// Routes point to /admin/* because that's where all dashboards live.

export const STAFF_PERMISSIONS = {
  leads: {
    key: 'leads',
    label: 'Leads za Madalali',
    description: 'Kuwasiliana na madalali watarajiwa, kuwafuatilia hadi wajisajili',
    adminPath: '/admin/staff-leads',
    icon: 'target',
  },
  whatsapp_support: {
    key: 'whatsapp_support',
    label: 'WhatsApp Support',
    description: 'Kuchukua mazungumzo ambayo Amina ameshindwa kusaidia',
    adminPath: '/admin/whatsapp',
    icon: 'message-circle',
  },
  social_media: {
    key: 'social_media',
    label: 'Social Media',
    description: 'Kupakia content, kujibu comments/DMs, kusimamia Facebook Groups',
    adminPath: '/admin/social',
    icon: 'brand-instagram',
  },
  legal_violations: {
    key: 'legal_violations',
    label: 'Malalamiko na Ukiukaji',
    description: 'Kuchunguza ripoti za utapeli/ukiukaji wa masharti',
    adminPath: '/admin/legal',
    icon: 'scale',
  },
  lead_scraper: {
    key: 'lead_scraper',
    label: 'Lead Scraper',
    description: 'Kuendesha scraping ya madalali wapya, kuona leads zote',
    adminPath: '/admin/leads',
    icon: 'robot',
  },
  listing_analytics: {
    key: 'listing_analytics',
    label: 'Listing Performance',
    description: 'Kuangalia listings zenye performance ndogo, CRM analytics',
    adminPath: '/admin/crm/analytics',
    icon: 'chart-bar',
  },
  spam_moderation: {
    key: 'spam_moderation',
    label: 'Spam Moderation',
    description: 'Kuangalia comments zilizoflagiwa, kuamua zifutwe au la',
    adminPath: '/admin/social',
    icon: 'ban',
  },
} as const

export type PermissionKey = keyof typeof STAFF_PERMISSIONS

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
    permissions: ['whatsapp_support', 'legal_violations'] as PermissionKey[],
  },
  social_media_manager: {
    label: 'Social Media Manager',
    permissions: ['social_media', 'spam_moderation'] as PermissionKey[],
  },
  quality_control: {
    label: 'Quality Control',
    permissions: ['spam_moderation', 'legal_violations', 'listing_analytics'] as PermissionKey[],
  },
  team_lead: {
    label: 'Team Lead',
    permissions: [
      'leads', 'whatsapp_support', 'social_media', 'legal_violations',
      'lead_scraper', 'listing_analytics', 'spam_moderation',
    ] as PermissionKey[],
  },
} as const

export type RoleTemplate = keyof typeof STAFF_ROLE_TEMPLATES

// Map admin route prefixes → required permission key (for nav filtering)
export const ROUTE_PERMISSION_MAP: Record<string, PermissionKey> = {
  '/admin/staff-leads':   'leads',
  '/admin/whatsapp':      'whatsapp_support',
  '/admin/social':        'social_media',
  '/admin/legal':         'legal_violations',
  '/admin/leads':         'lead_scraper',
  '/admin/crm/analytics': 'listing_analytics',
}
