// Client-safe CRM constants and types — no server imports

export const PIPELINE_STAGES = [
  {
    key:         'mpya',
    label:       'Mpya',
    icon:        'square-rounded-plus',
    description: 'Lead mpya, hajaguswa bado',
    color:       'gray',
    bgClass:     'bg-gray-100',
    textClass:   'text-gray-700',
    badgeClass:  'bg-gray-100 text-gray-700',
  },
  {
    key:         'mawasiliano',
    label:       'Mawasiliano',
    icon:        'phone',
    description: 'Staff amewasiliana naye angalau mara moja',
    color:       'blue',
    bgClass:     'bg-blue-50',
    textClass:   'text-blue-700',
    badgeClass:  'bg-blue-100 text-blue-700',
  },
  {
    key:         'anajisajili',
    label:       'Anajisajili',
    icon:        'pencil',
    description: 'Yupo kwenye process ya kujisajili',
    color:       'amber',
    bgClass:     'bg-amber-50',
    textClass:   'text-amber-700',
    badgeClass:  'bg-amber-100 text-amber-700',
  },
  {
    key:         'ameweka_listing',
    label:       'Ameweka Listing',
    icon:        'home',
    description: 'Amejisajili na ameweka listing yake ya kwanza',
    color:       'purple',
    bgClass:     'bg-purple-50',
    textClass:   'text-purple-700',
    badgeClass:  'bg-purple-100 text-purple-700',
  },
  {
    key:         'amefanikiwa',
    label:       'Amefanikiwa',
    icon:        'circle-check',
    description: 'Dalali kamili — anaendelea kutumia platform',
    color:       'green',
    bgClass:     'bg-green-50',
    textClass:   'text-green-700',
    badgeClass:  'bg-green-100 text-green-700',
  },
  {
    key:         'amepotea',
    label:       'Amepotea',
    icon:        'circle-x',
    description: 'Hawezi kupatikana au hakupenda kujiunga',
    color:       'red',
    bgClass:     'bg-red-50',
    textClass:   'text-red-700',
    badgeClass:  'bg-red-100 text-red-700',
  },
] as const

export type PipelineStage = typeof PIPELINE_STAGES[number]['key']

export const SOURCE_LABELS: Record<string, string> = {
  google_maps:        'Google Maps',
  google_business:    'Google Business',
  facebook_pages:     'Facebook',
  facebook_groups:    'FB Groups',
  instagram:          'Instagram',
  whatsapp_amina:     'Amina (WhatsApp)',
  instagram_amina:    'Amina (IG)',
  facebook_amina:     'Amina (FB)',
  manual:             'Manual',
}

export type DalaliLead = {
  id:                     string
  business_name?:         string
  phone?:                 string
  whatsapp?:              string
  region?:                string
  source?:                string
  pipeline_stage:         string
  assigned_to?:           string
  assigned_at?:           string
  last_contacted_at?:     string
  contact_attempts?:      number
  next_followup_at?:      string
  notes?:                 string
  converted_to_profile_id?: string
  converted_at?:          string
  first_listing_id?:      string
  first_listing_at?:      string
  status?:                string
  created_at:             string
  updated_at?:            string
  assigned_staff?:        { id: string; full_name?: string; phone?: string } | null
  converted_profile?:     { id: string; full_name?: string } | null
}
