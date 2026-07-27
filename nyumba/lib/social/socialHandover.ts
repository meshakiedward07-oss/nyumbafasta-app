import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'
import { sendIGDM, sendFBMessage } from './metaClient'

export type SocialPlatform = 'instagram' | 'facebook'
export type SessionStatus  = 'amina' | 'pending' | 'admin' | 'resolved'

// ── Session management ─────────────────────────────────────────────────────

export interface SocialSession {
  id:                string
  platform:          SocialPlatform
  sender_id:         string
  sender_name:       string | null
  status:            SessionStatus
  assigned_admin_id: string | null
  escalation_reason: string | null
  escalated_at:      string | null
  resolved_at:       string | null
  last_message_at:   string
  created_at:        string
  updated_at:        string
}

export async function getOrCreateSocialSession(
  platform: SocialPlatform,
  senderId: string,
  senderName?: string,
): Promise<SocialSession> {
  const { data, error } = await supabaseAdmin
    .from('social_sessions')
    .upsert(
      {
        platform,
        sender_id:       senderId,
        sender_name:     senderName ?? null,
        last_message_at: new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      },
      { onConflict: 'platform,sender_id', ignoreDuplicates: false },
    )
    .select()
    .single()

  if (error || !data) throw new Error(`getOrCreateSocialSession: ${error?.message}`)
  return data as SocialSession
}

export async function getSocialSession(
  platform: SocialPlatform,
  senderId: string,
): Promise<SocialSession | null> {
  const { data } = await supabaseAdmin
    .from('social_sessions')
    .select('*')
    .eq('platform', platform)
    .eq('sender_id', senderId)
    .maybeSingle()
  return data as SocialSession | null
}

export async function updateSocialSession(
  platform: SocialPlatform,
  senderId: string,
  updates: Partial<SocialSession>,
): Promise<void> {
  await supabaseAdmin
    .from('social_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('platform', platform)
    .eq('sender_id', senderId)
}

// ── Escalation detection — mirrors WhatsApp's detectEscalation ────────────

const ESCALATION_KEYWORDS = [
  'tatizo kubwa', 'sijalipwa', 'mnaniiba', 'mnaidanganya', 'fraud',
  'fake listing', 'napoteza pesa', 'help urgent', 'emergency', 'dharura',
  'haki zangu', 'nataka mkubwa wenu', 'ombudsman', 'polisi', 'korti',
  'nimepata hasara', 'msaada wa haraka',
]

export function detectSocialEscalation(text: string): string | null {
  const lower = text.toLowerCase()
  for (const kw of ESCALATION_KEYWORDS) {
    if (lower.includes(kw)) return kw
  }
  return null
}

// ── Escalate to pending (admin review queue) ───────────────────────────────

export async function escalateSocialToAdmin(
  platform: SocialPlatform,
  senderId: string,
  senderName: string | undefined,
  reason: string,
): Promise<void> {
  await updateSocialSession(platform, senderId, {
    status:            'pending',
    escalation_reason: reason,
    escalated_at:      new Date().toISOString(),
  })

  const nameLabel = senderName ? ` (${senderName})` : ''
  console.log(`[SocialHandover] Escalated ${platform}:${senderId.slice(0, 6)}***${nameLabel} → ${reason}`)

  void supabaseAdmin.from('notifications').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    title:   `${platform === 'instagram' ? 'Instagram' : 'Facebook'}: Mteja anahitaji msaada`,
    body:    `Sender: ${senderId.slice(0, 6)}***${nameLabel}. Sababu: "${reason}"`,
    type:    'support_request',
    is_read: false,
  })
}

// ── Admin takeover ─────────────────────────────────────────────────────────

export async function adminTakeSocialSession(
  platform: SocialPlatform,
  senderId: string,
  adminId: string,
): Promise<void> {
  await updateSocialSession(platform, senderId, {
    status:            'admin',
    assigned_admin_id: adminId,
  })
}

// ── Admin handback to Amina ────────────────────────────────────────────────

export async function adminHandbackSocialSession(
  platform: SocialPlatform,
  senderId: string,
): Promise<void> {
  await updateSocialSession(platform, senderId, {
    status:            'amina',
    assigned_admin_id: null,
    escalation_reason: null,
    escalated_at:      null,
  })
}

// ── Resolve session ────────────────────────────────────────────────────────

export async function resolveSocialSession(
  platform: SocialPlatform,
  senderId: string,
): Promise<void> {
  await updateSocialSession(platform, senderId, {
    status:      'resolved',
    resolved_at: new Date().toISOString(),
  })

  void supabaseAdmin
    .from('cascade_miss_log')
    .update({ reviewed: true })
    .eq('session_id', `${platform}-${senderId}`)
    .eq('handover_triggered', true)
    .eq('reviewed', false)
    .then(() => null, () => null)
}

// ── Send admin message to user via platform ───────────────────────────────

export async function sendSocialAdminMessage(
  platform: SocialPlatform,
  senderId: string,
  sessionId: string,
  content: string,
  adminId: string,
): Promise<void> {
  if (platform === 'instagram') {
    await sendIGDM(senderId, content)
  } else {
    await sendFBMessage(senderId, content)
  }

  await supabaseAdmin.from('social_handover_messages').insert({
    session_id: sessionId,
    role:       'admin',
    content,
    sent_by:    adminId,
    sent_at:    new Date().toISOString(),
  })
}

// ── List active sessions for admin panel ──────────────────────────────────

export async function listActiveSocialSessions(
  status?: SessionStatus,
  limit = 50,
): Promise<SocialSession[]> {
  let query = supabaseAdmin
    .from('social_sessions')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  } else {
    query = query.in('status', ['pending', 'admin'])
  }

  const { data } = await query
  return (data ?? []) as SocialSession[]
}
