import { sendTextMessage, formatPhoneNumber } from '@/lib/whatsapp/client'
import type { CheckResult } from './checker'

const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'
const ADMIN_PHONE = process.env.ADMIN_WHATSAPP_NUMBER ?? '255615261147'

export async function notifyAdminOfCriticalAlerts(result: CheckResult): Promise<void> {
  const phone = ADMIN_PHONE
  if (!phone) return

  const newCritical = result.metrics.filter(m => m.triggered && m.severity === 'critical')
  if (newCritical.length === 0) return

  // Only notify about newly fired events, not already-open ones
  // result.fired is the total new events — if 0, nothing new to report
  if (result.fired === 0) return

  const critical = newCritical.filter(m => m.severity === 'critical')
  const warning  = result.metrics.filter(m => m.triggered && m.severity === 'warning')

  const lines: string[] = [
    `🚨 *NyumbaFasta — Tahadhari Mpya*`,
    ``,
    `Tahadhari mpya ${result.fired} zimewaka (${new Date(result.ran_at).toLocaleString('sw-TZ', { timeZone: 'Africa/Dar_es_Salaam', hour: '2-digit', minute: '2-digit' })})`,
    ``,
  ]

  if (critical.length > 0) {
    lines.push(`🔴 *Muhimu (${critical.length}):*`)
    for (const m of critical) {
      lines.push(`• ${m.display_name}: ${m.current_value} (kikomo: ${m.threshold_value})`)
    }
    lines.push(``)
  }

  if (warning.length > 0) {
    lines.push(`🟡 *Angalizo (${warning.length}):*`)
    for (const m of warning) {
      lines.push(`• ${m.display_name}: ${m.current_value} (kikomo: ${m.threshold_value})`)
    }
    lines.push(``)
  }

  lines.push(`👉 ${APP_URL}/admin/alerts`)

  const to = formatPhoneNumber(phone)
  await sendTextMessage(to, lines.join('\n'))
}
