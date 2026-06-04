/* eslint-disable @typescript-eslint/no-explicit-any */
export type LeadSource =
  | 'google_maps'
  | 'google_business'
  | 'facebook_groups'
  | 'facebook_pages'
  | 'facebook_profile'
  | 'instagram'
  | 'tiktok'
  | 'manual'

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'interested'
  | 'converted'
  | 'rejected'

export type AgentLead = {
  id?: string
  business_name: string
  phone?: string | null
  email?: string | null
  region?: string | null
  source: LeadSource
  source_id?: string | null
  source_url?: string | null
  website_url?: string | null
  facebook_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  whatsapp?: string | null
  ai_score?: number
  ai_notes?: string | null
  ai_analyzed_at?: string | null
  status?: LeadStatus
  converted_user_id?: string | null
  converted_at?: string | null
  notes?: string | null
  raw_data?: any
  created_at?: string
  updated_at?: string
}

export type ClaudeAnalysis = {
  is_agent: boolean
  business_name: string
  phone: string | null
  email: string | null
  region: string
  website: string | null
  facebook_url: string | null
  instagram_url: string | null
  tiktok_url: string | null
  whatsapp: string | null
  score: number
  notes: string
}

export type RunnerResult = {
  runId: string
  source: LeadSource
  status: string
  error?: string
}

export type SaveResult = {
  saved: boolean
  id: string | null
  isNew: boolean
  error?: string
}
