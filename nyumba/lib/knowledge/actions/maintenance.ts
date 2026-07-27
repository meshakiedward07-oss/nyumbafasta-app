// Action: Create maintenance request for a tenant.
// Only executes when we can resolve the user (by phone) and find their active lease.
// Falls through (returns null) when context is missing — Amina handles the rest.

import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import type { MaintenanceCategory, MaintenancePriority } from '@/lib/knowledge/actionIntent'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

interface ResolvedTenant {
  userId:  string
  orgId:   string
  unitId:  string
  leaseId: string
}

// Look up user by WhatsApp phone (international, no +). Tries multiple formats.
async function resolveTenantByPhone(phone: string): Promise<{ userId: string } | null> {
  const digits = phone.replace(/\D/g, '')
  const last9  = digits.slice(-9)

  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .ilike('phone', `%${last9}`)
    .limit(1)
    .maybeSingle()

  return data ? { userId: data.id } : null
}

async function resolveActiveLease(userId: string): Promise<ResolvedTenant | null> {
  const { data } = await supabaseAdmin
    .from('leases')
    .select('id, org_id, unit_id')
    .eq('tenant_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  return { userId, orgId: data.org_id, unitId: data.unit_id, leaseId: data.id }
}

export interface MaintenanceActionResult {
  success:  boolean
  message:  string
  requestId?: string
}

export async function executeMaintenanceAction(
  phone:       string,
  description: string,
  category:    MaintenanceCategory = 'other',
  priority:    MaintenancePriority = 'medium',
): Promise<MaintenanceActionResult | null> {
  // Step 1: resolve tenant by phone
  const userCtx = await resolveTenantByPhone(phone)
  if (!userCtx) return null   // not a registered user — Amina handles it

  // Step 2: resolve active lease
  const tenant = await resolveActiveLease(userCtx.userId)
  if (!tenant) {
    return {
      success: false,
      message:
        'Samahani, sikupata mkataba wako hai wa upangaji kwenye mfumo wetu. 😔\n\n' +
        'Kama una mkataba, tafadhali wasiliana na msimamizi wako moja kwa moja, ' +
        `au tembelea ${APP_URL} ukiwa umeingia kwenye akaunti yako.`,
    }
  }

  // Step 3: create the maintenance request
  const title = description.length <= 80
    ? description
    : description.slice(0, 77) + '...'

  const { data, error } = await supabaseAdmin
    .from('maintenance_requests')
    .insert({
      org_id:      tenant.orgId,
      unit_id:     tenant.unitId,
      reported_by: tenant.userId,
      title,
      description,
      category,
      priority,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[Maintenance Action] Insert failed:', error.message)
    return {
      success: false,
      message:
        'Samahani, kulikuwa na tatizo la kiufundi wakati wa kuwasilisha ombi lako. 😔\n' +
        'Tafadhali jaribu tena, au wasiliana na msimamizi wako moja kwa moja.',
    }
  }

  const priorityEmoji: Record<MaintenancePriority, string> = {
    low:    '🟡',
    medium: '🟠',
    high:   '🔴',
    urgent: '🆘',
  }

  const categoryLabel: Record<MaintenanceCategory, string> = {
    plumbing:   'Mabomba/Maji',
    electrical: 'Umeme',
    structural: 'Muundo wa Nyumba',
    cleaning:   'Usafi',
    security:   'Usalama',
    appliance:  'Vifaa vya Nyumbani',
    other:      'Nyingine',
  }

  return {
    success:   true,
    requestId: data.id,
    message:
      `✅ *Ombi la Matengenezo Limepokelewa!*\n\n` +
      `📋 Tatizo: ${title}\n` +
      `🔧 Aina: ${categoryLabel[category]}\n` +
      `${priorityEmoji[priority]} Kipaumbele: ${priority === 'urgent' ? 'Dharura' : priority === 'high' ? 'Juu' : priority === 'medium' ? 'Wastani' : 'Chini'}\n\n` +
      `Msimamizi atawasiliana nawe hivi karibuni. Unaweza kufuatilia ombi lako kwenye:\n` +
      `🔗 ${APP_URL}/tenant/maintenance`,
  }
}
