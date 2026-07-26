// Property Management System — shared TypeScript types

export type OrgType    = 'landlord' | 'property_manager' | 'firm'
export type OrgStatus  = 'active' | 'suspended' | 'pending'
export type OrgRole    = 'owner' | 'branch_manager' | 'agent' | 'maintenance_coordinator' | 'accountant'
export type AgreementScope   = 'maintenance_only' | 'full_management' | 'staff_assisted_listing'
export type AgreementStatus  = 'pending' | 'active' | 'ended' | 'cancelled'
export type CommissionRuleType = 'flat_fee' | 'percent_first_month' | 'percent_annual'
export type CollectionStatus = 'pending' | 'invoiced' | 'collected' | 'overdue'
export type LifecycleStatus  = 'draft' | 'listed' | 'under_offer' | 'leased_managed' | 'ended' | 'relisted'
export type ServiceRequestType   = 'staff_assisted_listing' | 'kyc_only' | 'management_setup'
export type ServiceRequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold'
export type KycStatus = 'pending' | 'approved' | 'rejected' | 'needs_more_info'

export interface Organization {
  id:          string
  name:        string
  org_type:    OrgType
  description: string | null
  phone:       string | null
  email:       string | null
  logo_url:    string | null
  region:      string | null
  district:    string | null
  status:      OrgStatus
  created_by:  string | null
  created_at:  string
  updated_at:  string
}

export interface OrganizationMember {
  id:              string
  organization_id: string
  user_id:         string
  role:            OrgRole
  invited_by:      string | null
  joined_at:       string
  user?: {
    full_name:  string | null
    email:      string | null
    phone:      string | null
    avatar_url: string | null
  }
}

export interface ManagementAgreement {
  id:               string
  landlord_id:      string
  managing_org_id:  string
  listing_id:       string | null
  scope:            AgreementScope
  commission_type:  CommissionRuleType | null
  commission_value: number | null
  start_date:       string | null
  end_date:         string | null
  status:           AgreementStatus
  document_url:     string | null
  notes:            string | null
  created_at:       string
  updated_at:       string
  // Joined
  landlord?:      { full_name: string | null; phone: string | null }
  organization?:  { name: string; org_type: OrgType }
  listing?:       { title: string; district: string; region: string } | null
}

export interface CommissionRule {
  id:          string
  rule_type:   CommissionRuleType
  value:       number
  description: string | null
  active:      boolean
  created_by:  string | null
  created_at:  string
}

export interface BrokerageCommission {
  id:                string
  listing_id:        string
  landlord_id:       string
  staff_id:          string | null
  rule_id:           string | null
  calculated_amount: number | null
  collection_status: CollectionStatus
  invoice_sent_at:   string | null
  collected_at:      string | null
  collected_by:      string | null
  proof_url:         string | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

export interface ServiceRequest {
  id:            string
  landlord_id:   string
  assigned_to:   string | null
  listing_id:    string | null
  request_type:  ServiceRequestType
  status:        ServiceRequestStatus
  title:         string | null
  description:   string | null
  notes:         string | null
  conflict_flag: boolean
  created_at:    string
  updated_at:    string
  landlord?:     { full_name: string | null; phone: string | null }
  assignee?:     { full_name: string | null } | null
}

export interface KycSubmission {
  id:                 string
  service_request_id: string
  landlord_id:        string
  reviewed_by:        string | null
  status:             KycStatus
  id_document_url:    string | null
  title_deed_url:     string | null
  tax_cert_url:       string | null
  notes:              string | null
  rejection_reason:   string | null
  submitted_at:       string
  reviewed_at:        string | null
}

export interface StaffWorkload {
  staff_id:                  string
  active_managed_properties: number
  max_capacity:              number
  updated_at:                string
  staff?: { full_name: string | null; email: string | null }
}

// Display helpers
export const ORG_TYPE_LABELS: Record<OrgType, string> = {
  landlord:         'Mmiliki wa Nyumba',
  property_manager: 'Msimamizi wa Mali',
  firm:             'Kampuni ya Mali',
}

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner:                   'Mwenye Shirika',
  branch_manager:          'Meneja wa Tawi',
  agent:                   'Wakala',
  maintenance_coordinator: 'Mratibu wa Matengenezo',
  accountant:              'Mhasibu',
}

export const AGREEMENT_SCOPE_LABELS: Record<AgreementScope, string> = {
  maintenance_only:        'Matengenezo Tu',
  full_management:         'Usimamizi Kamili',
  staff_assisted_listing:  'Usaidizi wa Kutangaza',
}

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  pending:   'Inasubiri',
  active:    'Inaendelea',
  ended:     'Imekwisha',
  cancelled: 'Imefutwa',
}

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  draft:          'Rasimu',
  listed:         'Imetangazwa',
  under_offer:    'Chini ya Ofa',
  leased_managed: 'Imepangishwa',
  ended:          'Imekwisha',
  relisted:       'Imetangazwa Tena',
}

export const COLLECTION_STATUS_LABELS: Record<CollectionStatus, string> = {
  pending:  'Inasubiri',
  invoiced: 'Invoice Imetumwa',
  collected: 'Imekusanywa',
  overdue:  'Imechelewa',
}
