import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

export type WASessionStatus = 'amina' | 'pending' | 'admin' | 'resolved'

export interface WASession {
  id: string
  phone_number: string
  status: WASessionStatus
  assigned_admin_id: string | null
  escalation_reason: string | null
  escalated_at: string | null
  resolved_at: string | null
  last_message_at: string
  created_at: string
  updated_at: string
}

export interface WAMessage {
  id: string
  phone_number: string
  direction: 'inbound' | 'outbound'
  sender: 'user' | 'amina' | 'admin' | 'system'
  content: string
  message_id: string | null
  status: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ── Session management ────────────────────────────────────────────────────────

export async function getWASession(phone: string): Promise<WASession | null> {
  const { data } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle()
  return (data as WASession) ?? null
}

export async function getOrCreateWASession(phone: string): Promise<WASession> {
  const now = new Date().toISOString()

  const { data: existing } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('*')
    .eq('phone_number', phone)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin
      .from('whatsapp_sessions')
      .update({ last_message_at: now, updated_at: now })
      .eq('phone_number', phone)
    return existing as WASession
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .insert({ phone_number: phone, status: 'amina', last_message_at: now })
    .select()
    .single()

  if (error) throw new Error(`WA session create failed: ${error.message}`)
  return data as WASession
}

export async function updateWASession(
  phone: string,
  updates: Partial<Omit<WASession, 'id' | 'phone_number' | 'created_at'>>,
): Promise<void> {
  await supabaseAdmin
    .from('whatsapp_sessions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('phone_number', phone)
}

// ── Message store ─────────────────────────────────────────────────────────────

export async function saveWAMessage(
  phoneNumber: string,
  direction: 'inbound' | 'outbound',
  sender: 'user' | 'amina' | 'admin' | 'system',
  content: string,
  messageId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await supabaseAdmin.from('whatsapp_messages').insert({
    phone_number: phoneNumber,
    direction,
    sender,
    content,
    message_id: messageId ?? null,
    metadata: metadata ?? null,
  })
}

export async function getWAMessages(phone: string, limit = 60): Promise<WAMessage[]> {
  const { data } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, phone_number, direction, sender, content, message_id, status, metadata, created_at')
    .eq('phone_number', phone)
    .order('created_at', { ascending: true })
    .limit(limit)
  return (data ?? []) as WAMessage[]
}

// ── Admin instructions ────────────────────────────────────────────────────────

export async function getAminaInstructions(phone: string): Promise<string> {
  const [globalRes, specificRes] = await Promise.all([
    supabaseAdmin
      .from('amina_instructions')
      .select('instruction')
      .eq('scope', 'global')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('amina_instructions')
      .select('instruction')
      .eq('scope', 'phone_specific')
      .eq('phone_number', phone)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const all = [
    ...(globalRes.data ?? []),
    ...(specificRes.data ?? []),
  ].map((i) => i.instruction)

  return all.length > 0 ? all.join('\n') : ''
}

// ── Escalation detection ──────────────────────────────────────────────────────

const ESCALATION_KEYWORDS = [
  'agent', 'admin', 'manager', 'supervisor', 'binadamu', 'mtu wa kweli',
  'mtu halisi', 'msaada wa haraka', 'nataka kuzungumza na mtu',
  'nataka kuzungumza na binadamu', 'sitaki bot', 'sitaki amina',
  'mnaniudhi', 'hii ni upuuzi', 'huu ni upuuzi', 'ninahitaji mtu',
  'umeniudhi', 'hujasaidia', 'haijasaidia', 'tatizo bado', 'bado tatizo',
  'bado shida', 'shida bado', 'hakuna msaada', 'hatuwezi', 'nataka refund',
  'nitalalamika', 'nitaleta malalamiko', 'legal', 'mahakama',
]

export function detectEscalation(message: string): string | null {
  const lower = message.toLowerCase().trim()
  for (const kw of ESCALATION_KEYWORDS) {
    if (lower.includes(kw)) {
      return `Neno la hatua: "${kw}"`
    }
  }
  return null
}
