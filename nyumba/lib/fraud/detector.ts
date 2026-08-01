import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FraudSignalType =
  | 'duplicate_phone'
  | 'duplicate_device'
  | 'duplicate_ip'
  | 'rapid_accounts'
  | 'rapid_unlocks'
  | 'suspicious_payment'

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface DeviceInfo {
  userId: string
  fingerprint: string
  ipAddress: string
  userAgent: string
  platform?: string
  screenSize?: string
  timezone?: string
  language?: string
}

export interface FraudCheckContext {
  userId: string
  phone?: string
  ip: string
  fingerprint?: string
  userAgent?: string
}

// ── Score weights ─────────────────────────────────────────────────────────────

const SCORE_WEIGHTS: Record<FraudSignalType, number> = {
  duplicate_phone:     30,
  duplicate_device:    25,
  duplicate_ip:        20,
  rapid_accounts:      25,
  rapid_unlocks:       15,
  suspicious_payment:  20,
}

const SEVERITY_MAP: Record<FraudSignalType, FraudSeverity> = {
  duplicate_phone:     'high',
  duplicate_device:    'medium',
  duplicate_ip:        'medium',
  rapid_accounts:      'high',
  rapid_unlocks:       'low',
  suspicious_payment:  'medium',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSignal(
  admin: SupabaseClient,
  userId: string,
  signalType: FraudSignalType,
  description: string,
  evidence: Record<string, unknown>,
  relatedUserIds: string[] = [],
  relatedIp?: string,
  overrideSeverity?: FraudSeverity,
) {
  // Skip if an unresolved signal of this type already exists for this user
  const { data: existing } = await admin
    .from('fraud_signals')
    .select('id')
    .eq('user_id', userId)
    .eq('signal_type', signalType)
    .eq('is_resolved', false)
    .maybeSingle()

  if (existing) return

  const severity = overrideSeverity ?? SEVERITY_MAP[signalType]

  await admin.from('fraud_signals').insert({
    user_id:          userId,
    signal_type:      signalType,
    severity,
    description,
    evidence,
    related_user_ids: relatedUserIds,
    related_ip:       relatedIp ?? null,
  })
}

async function incrementFraudScore(
  admin: SupabaseClient,
  userId: string,
  signalType: FraudSignalType,
  flagKey: string,
) {
  const { data: user } = await admin
    .from('users')
    .select('fraud_score, fraud_flags')
    .eq('id', userId)
    .maybeSingle()

  if (!user) return

  const currentScore  = (user.fraud_score as number | null) ?? 0
  const currentFlags  = (user.fraud_flags as Record<string, unknown> | null) ?? {}
  const delta         = SCORE_WEIGHTS[signalType]
  const newScore      = Math.min(currentScore + delta, 100)
  const updatedFlags  = { ...currentFlags, [flagKey]: new Date().toISOString() }

  await admin.from('users').update({
    fraud_score: newScore,
    fraud_flags: updatedFlags,
  }).eq('id', userId)
}

// ── IP Activity Logging ───────────────────────────────────────────────────────

export async function logIpActivity(
  admin: SupabaseClient,
  ip: string,
  userId: string,
  eventType: 'register' | 'unlock' | 'login' | 'payment',
  metadata?: Record<string, unknown>,
) {
  await admin.from('ip_activity_log').insert({
    ip_address: ip,
    user_id:    userId,
    event_type: eventType,
    metadata:   metadata ?? null,
  })
}

// ── Device Session Upsert ─────────────────────────────────────────────────────

export async function upsertDeviceSession(admin: SupabaseClient, info: DeviceInfo) {
  const { data: existing } = await admin
    .from('device_sessions')
    .select('id, session_count')
    .eq('user_id', info.userId)
    .eq('fingerprint_hash', info.fingerprint)
    .maybeSingle()

  if (existing) {
    await admin.from('device_sessions').update({
      last_seen_at:  new Date().toISOString(),
      session_count: (existing.session_count as number) + 1,
      ip_address:    info.ipAddress,
      user_agent:    info.userAgent,
    }).eq('id', existing.id)
  } else {
    await admin.from('device_sessions').insert({
      user_id:          info.userId,
      fingerprint_hash: info.fingerprint,
      ip_address:       info.ipAddress,
      user_agent:       info.userAgent,
      platform:         info.platform    ?? null,
      screen_size:      info.screenSize  ?? null,
      timezone:         info.timezone    ?? null,
      language:         info.language    ?? null,
    })
  }
}

// ── Duplicate Phone Detection ─────────────────────────────────────────────────

async function checkDuplicatePhone(
  admin: SupabaseClient,
  userId: string,
  phone: string,
) {
  const { data: others } = await admin
    .from('users')
    .select('id, full_name')
    .eq('phone', phone)
    .neq('id', userId)
    .limit(5)

  if (!others || others.length === 0) return

  const relatedIds = (others as { id: string }[]).map(u => u.id)

  const tasks = [
    createSignal(
      admin,
      userId,
      'duplicate_phone',
      `Namba ya simu ${phone} inatumiwa na akaunti nyingine ${relatedIds.length}.`,
      { phone, related_count: relatedIds.length },
      relatedIds,
    ),
    incrementFraudScore(admin, userId, 'duplicate_phone', 'duplicate_phone_detected'),
  ]

  await Promise.allSettled(tasks)
}

// ── Duplicate Device Detection ────────────────────────────────────────────────

async function checkDuplicateDevice(
  admin: SupabaseClient,
  userId: string,
  fingerprint: string,
) {
  const { data: others } = await admin
    .from('device_sessions')
    .select('user_id')
    .eq('fingerprint_hash', fingerprint)
    .neq('user_id', userId)
    .limit(5)

  if (!others || others.length === 0) return

  const relatedIds = [...new Set((others as { user_id: string }[]).map(s => s.user_id))]
  const severity: FraudSeverity = relatedIds.length >= 3 ? 'high' : 'medium'

  const tasks = [
    createSignal(
      admin,
      userId,
      'duplicate_device',
      `Kifaa kimoja kinatumiwa na akaunti ${relatedIds.length + 1} tofauti.`,
      { fingerprint_hash: fingerprint, related_account_count: relatedIds.length },
      relatedIds,
      undefined,
      severity,
    ),
    incrementFraudScore(admin, userId, 'duplicate_device', 'duplicate_device_detected'),
  ]

  await Promise.allSettled(tasks)
}

// ── Duplicate IP Detection ────────────────────────────────────────────────────

async function checkDuplicateIp(
  admin: SupabaseClient,
  userId: string,
  ip: string,
) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await admin
    .from('ip_activity_log')
    .select('user_id')
    .eq('ip_address', ip)
    .eq('event_type', 'register')
    .gte('created_at', since24h)
    .limit(20)

  if (!recent || recent.length < 2) return

  const uniqueUsers = [...new Set((recent as { user_id: string }[]).map(r => r.user_id))]

  // Only flag if 3+ distinct accounts registered from the same IP in 24 hours
  if (uniqueUsers.length < 3) return

  const otherUsers   = uniqueUsers.filter(id => id !== userId)
  const severity: FraudSeverity = uniqueUsers.length >= 5 ? 'critical' : 'high'

  const tasks = [
    createSignal(
      admin,
      userId,
      'duplicate_ip',
      `IP ${ip} ilitumika kusajili akaunti ${uniqueUsers.length} ndani ya masaa 24.`,
      { ip_address: ip, accounts_in_24h: uniqueUsers.length },
      otherUsers,
      ip,
      severity,
    ),
    incrementFraudScore(admin, userId, 'duplicate_ip', 'duplicate_ip_detected'),
  ]

  await Promise.allSettled(tasks)
}

// ── Rapid Unlocks Detection ───────────────────────────────────────────────────

async function checkRapidUnlocks(admin: SupabaseClient, userId: string) {
  const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count } = await admin
    .from('contact_unlocks')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', userId)
    .eq('status', 'completed')
    .gte('created_at', since1h)

  if ((count ?? 0) < 10) return

  const tasks = [
    createSignal(
      admin,
      userId,
      'rapid_unlocks',
      `Mtumiaji amefungua contacts ${count} ndani ya saa 1.`,
      { unlocks_in_1h: count },
    ),
    incrementFraudScore(admin, userId, 'rapid_unlocks', 'rapid_unlocks_detected'),
  ]

  await Promise.allSettled(tasks)
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function runFraudChecks(
  admin: SupabaseClient,
  ctx: FraudCheckContext,
) {
  const tasks: Promise<unknown>[] = [
    logIpActivity(admin, ctx.ip, ctx.userId, 'register'),
  ]

  if (ctx.phone) {
    tasks.push(checkDuplicatePhone(admin, ctx.userId, ctx.phone))
  }

  if (ctx.ip) {
    tasks.push(checkDuplicateIp(admin, ctx.userId, ctx.ip))
  }

  if (ctx.fingerprint) {
    tasks.push(checkDuplicateDevice(admin, ctx.userId, ctx.fingerprint))
  }

  // Fire-and-forget — never block the caller
  Promise.allSettled(tasks).catch(() => null)
}

export async function runDeviceFraudChecks(
  admin: SupabaseClient,
  info: DeviceInfo,
) {
  Promise.allSettled([
    upsertDeviceSession(admin, info),
    checkDuplicateDevice(admin, info.userId, info.fingerprint),
  ]).catch(() => null)
}

export async function runUnlockFraudChecks(
  admin: SupabaseClient,
  ctx: { userId: string; ip: string; msisdn?: string },
) {
  const tasks: Promise<unknown>[] = [
    logIpActivity(admin, ctx.ip, ctx.userId, 'unlock', { msisdn: ctx.msisdn }),
    checkRapidUnlocks(admin, ctx.userId),
  ]

  Promise.allSettled(tasks).catch(() => null)
}
