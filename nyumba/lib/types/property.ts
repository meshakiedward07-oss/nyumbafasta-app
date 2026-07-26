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

// ── Phase 2 types ─────────────────────────────────────────────────────────────

export type UnitType   = 'whole' | 'room' | 'floor' | 'apartment' | 'shop' | 'office'
export type UnitStatus = 'vacant' | 'occupied' | 'maintenance' | 'reserved'
export type LeaseStatus        = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed'
export type PaymentStatus      = 'pending' | 'paid' | 'late' | 'partial' | 'waived'
export type PaymentMethod      = 'mpesa' | 'cash' | 'bank_transfer' | 'airtel' | 'tigo'

export interface PropertyUnit {
  id:             string
  listing_id:     string
  org_id:         string | null
  unit_number:    string
  unit_type:      UnitType
  bedrooms:       number | null
  bathrooms:      number | null
  floor_number:   number | null
  monthly_rent:   number
  deposit_months: number
  status:         UnitStatus
  description:    string | null
  created_at:     string
  updated_at:     string
  // Joined
  listing?: { title: string; district: string; region: string; images: string[] }
  active_lease?: Lease | null
}

export interface Lease {
  id:                 string
  unit_id:            string
  listing_id:         string | null
  org_id:             string | null
  tenant_id:          string
  landlord_id:        string
  monthly_rent:       number
  deposit_amount:     number | null
  deposit_paid:       boolean
  deposit_paid_at:    string | null
  start_date:         string
  end_date:           string | null
  status:             LeaseStatus
  termination_reason: string | null
  document_url:       string | null
  notes:              string | null
  created_at:         string
  updated_at:         string
  // Joined
  tenant?:  { id: string; full_name: string | null; phone: string | null; email: string | null }
  landlord?: { full_name: string | null; phone: string | null }
  unit?:    { unit_number: string; unit_type: UnitType; monthly_rent: number }
  listing?: { title: string; district: string }
}

export interface LeasePayment {
  id:             string
  lease_id:       string
  amount_due:     number
  amount_paid:    number | null
  due_date:       string
  paid_date:      string | null
  status:         PaymentStatus
  payment_method: PaymentMethod | null
  reference:      string | null
  notes:          string | null
  recorded_by:    string | null
  created_at:     string
}

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  whole:     'Nyumba Yote',
  room:      'Chumba',
  floor:     'Ghorofa',
  apartment: 'Apartment',
  shop:      'Duka',
  office:    'Ofisi',
}

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  vacant:      'Iko Wazi',
  occupied:    'Imepangishwa',
  maintenance: 'Matengenezo',
  reserved:    'Imehifadhiwa',
}

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  draft:       'Rasimu',
  active:      'Inaendelea',
  expired:     'Imekwisha',
  terminated:  'Imesimamishwa',
  renewed:     'Imefanywa Upya',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Inasubiri',
  paid:    'Imelipwa',
  late:    'Imechelewa',
  partial: 'Sehemu',
  waived:  'Imesamehewa',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  mpesa:        'M-Pesa',
  cash:         'Pesa Taslimu',
  bank_transfer:'Uhamisho wa Benki',
  airtel:       'Airtel Money',
  tigo:         'Tigo Pesa',
}

// ── Phase 3 types ─────────────────────────────────────────────────────────────

export type ConvType       = 'lease' | 'service_request' | 'agreement' | 'maintenance' | 'general'
export type ConvStatus     = 'open' | 'closed' | 'archived'
export type MessageType    = 'text' | 'system' | 'note'
export type ParticipantRole = 'owner' | 'member' | 'observer'

export interface Conversation {
  id:              string
  title:           string | null
  conv_type:       ConvType
  status:          ConvStatus
  context_type:    string | null
  context_id:      string | null
  org_id:          string | null
  created_by:      string
  last_message_at: string | null
  created_at:      string
  updated_at:      string
  // Joined
  participants?:   ConversationParticipant[]
  last_message?:   Message | null
  unread_count?:   number
}

export interface ConversationParticipant {
  id:              string
  conversation_id: string
  user_id:         string
  role:            ParticipantRole
  last_read_at:    string | null
  joined_at:       string
  user?: {
    id: string
    full_name: string | null
    phone:     string | null
    avatar_url: string | null
  }
}

export interface Message {
  id:              string
  conversation_id: string
  sender_id:       string
  body:            string
  message_type:    MessageType
  is_internal:     boolean
  created_at:      string
  deleted_at:      string | null
  sender?: {
    id:         string
    full_name:  string | null
    avatar_url: string | null
  }
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id:         string
  message_id: string
  file_url:   string
  file_name:  string | null
  file_type:  string | null
  file_size:  number | null
  created_at: string
}

export const CONV_TYPE_LABELS: Record<ConvType, string> = {
  lease:           'Mkataba wa Upangaji',
  service_request: 'Ombi la Huduma',
  agreement:       'Makubaliano ya Usimamizi',
  maintenance:     'Matengenezo',
  general:         'Mazungumzo ya Kawaida',
}

export const CONV_TYPE_ICONS: Record<ConvType, string> = {
  lease:           'file-text',
  service_request: 'clipboard',
  agreement:       'file-check',
  maintenance:     'tool',
  general:         'message',
}
