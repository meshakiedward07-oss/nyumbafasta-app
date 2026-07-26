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
  id:              string
  name:            string
  org_type:        OrgType
  description:     string | null
  phone:           string | null
  email:           string | null
  logo_url:        string | null
  region:          string | null
  district:        string | null
  status:          OrgStatus
  created_by:      string | null
  created_at:      string
  updated_at:      string
  // Billing info (Phase 1)
  billing_name:    string | null
  billing_address: string | null
  billing_phone:   string | null
  billing_email:   string | null
  tax_id:          string | null
  deactivated_at:  string | null
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

// ── Phase 4: Maintenance ──────────────────────────────────────────────────

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'structural' | 'cleaning' | 'security' | 'appliance' | 'other'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type MaintenanceStatus   = 'open' | 'assigned' | 'in_progress' | 'awaiting_parts' | 'resolved' | 'closed' | 'cancelled'

export interface MaintenanceRequest {
  id:              string
  org_id:          string
  unit_id:         string | null
  lease_id:        string | null
  title:           string
  description:     string | null
  category:        MaintenanceCategory
  priority:        MaintenancePriority
  status:          MaintenanceStatus
  reported_by:     string
  assigned_to:     string | null
  estimated_cost:  number | null
  actual_cost:     number | null
  images:          string[]
  scheduled_at:    string | null
  resolved_at:     string | null
  notes:           string | null
  conversation_id: string | null
  created_at:      string
  updated_at:      string
}

export interface MaintenanceComment {
  id:            string
  request_id:    string
  author_id:     string
  body:          string
  is_internal:   boolean
  status_change: string | null
  created_at:    string
}

export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plumbing:   'Mabomba',
  electrical: 'Umeme',
  structural: 'Ujenzi',
  cleaning:   'Usafi',
  security:   'Usalama',
  appliance:  'Vifaa vya Nyumba',
  other:      'Nyingine',
}

export const MAINTENANCE_CATEGORY_ICONS: Record<MaintenanceCategory, string> = {
  plumbing:   'droplet',
  electrical: 'bolt',
  structural: 'building',
  cleaning:   'brush',
  security:   'shield',
  appliance:  'device-floppy',
  other:      'tool',
}

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low:    'Chini',
  medium: 'Wastani',
  high:   'Juu',
  urgent: 'Dharura',
}

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  open:           'Wazi',
  assigned:       'Imepewa',
  in_progress:    'Inaendelea',
  awaiting_parts: 'Inasubiri Vifaa',
  resolved:       'Imeshughulikiwa',
  closed:         'Imefungwa',
  cancelled:      'Imesitishwa',
}

export const MAINTENANCE_STATUS_NEXT: Partial<Record<MaintenanceStatus, MaintenanceStatus[]>> = {
  open:           ['assigned', 'in_progress', 'cancelled'],
  assigned:       ['in_progress', 'cancelled'],
  in_progress:    ['awaiting_parts', 'resolved'],
  awaiting_parts: ['in_progress', 'resolved'],
  resolved:       ['closed'],
}

export const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high:   'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low:    'bg-gray-100 text-gray-500 border-gray-200',
}

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  open:           'bg-blue-100 text-blue-700',
  assigned:       'bg-purple-100 text-purple-700',
  in_progress:    'bg-amber-100 text-amber-700',
  awaiting_parts: 'bg-orange-100 text-orange-700',
  resolved:       'bg-green-100 text-green-700',
  closed:         'bg-gray-100 text-gray-500',
  cancelled:      'bg-red-100 text-red-400',
}

// ── Phase 1: Subscriptions ─────────────────────────────────────────────────

export type SubscriptionBillingCycle = 'monthly' | 'quarterly' | 'annual'
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'grace_period' | 'cancelled' | 'expired'

export interface PlanFeatures {
  max_properties:             number  // -1 = unlimited
  max_units:                  number
  max_members:                number
  has_reports:                boolean
  has_maintenance:            boolean
  has_communication_hub:      boolean
  has_vendor_directory:       boolean
  has_staff_assisted_listing: boolean
  has_priority_support:       boolean
  trial_days:                 number
}

export interface SubscriptionPlan {
  id:            string
  name:          string
  description:   string | null
  price_tzs:     number
  billing_cycle: SubscriptionBillingCycle
  is_active:     boolean
  is_public:     boolean
  is_default:    boolean
  features:      PlanFeatures
  created_by:    string | null
  created_at:    string
  updated_at:    string
}

export interface OrganizationSubscription {
  id:                     string
  org_id:                 string
  plan_id:                string | null
  status:                 SubscriptionStatus
  trial_ends_at:          string | null
  current_period_start:   string | null
  current_period_end:     string | null
  pending_plan_id:        string | null
  pending_plan_starts_at: string | null
  cancelled_at:           string | null
  cancellation_reason:    string | null
  created_at:             string
  updated_at:             string
  plan?:                  SubscriptionPlan | null
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial:        'Kipindi cha Majaribio',
  active:       'Inaendelea',
  past_due:     'Malipo Yamechelewa',
  grace_period: 'Muda wa Neema',
  cancelled:    'Imesitishwa',
  expired:      'Imekwisha',
}
