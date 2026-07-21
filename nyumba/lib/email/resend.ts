import { Resend } from 'resend'
import { emailBase } from './templates'

export function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('[Resend] RESEND_API_KEY is not set')
  return new Resend(key)
}

export const FROM_ADDRESS = 'NyumbaFasta <noreply@nyumbafasta.co>'
export const REPLY_DOMAIN = process.env.RESEND_INBOUND_DOMAIN ?? 'nyumbafasta.co'

/**
 * Thin wrapper around resend.emails.send() — handles key checks, singleton
 * construction, and consistent error logging. Returns { ok, id }.
 */
export async function sendMail(opts: {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}): Promise<{ ok: boolean; id?: string }> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('[Resend] RESEND_API_KEY not set — email skipped:', opts.subject)
    return { ok: false }
  }
  try {
    const { data, error } = await new Resend(key).emails.send({
      from:    opts.from ?? FROM_ADDRESS,
      to:      Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html:    opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    })
    if (error) { console.error('[Resend] send error:', error); return { ok: false } }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error('[Resend] exception:', err)
    return { ok: false }
  }
}

export function buildEmailHtml(opts: {
  recipientName: string
  subject: string
  bodyText: string
  senderName: string
}): string {
  const paragraphs = opts.bodyText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p style="margin:0 0 14px;color:#374151;font-size:15px;line-height:1.6">${line}</p>`)
    .join('')

  const content = `
    <p style="margin:0 0 20px;color:#111827;font-size:18px;font-weight:700">
      Habari ${opts.recipientName.split(' ')[0]},
    </p>
    ${paragraphs}
    <p style="margin:24px 0 0;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;padding-top:16px">
      Ujumbe huu umetumwa na <strong>${opts.senderName}</strong> kutoka timu ya NyumbaFasta.
      Ukihitaji msaada, tupigie simu au tuandikie WhatsApp.
    </p>
  `
  return emailBase(content, opts.subject)
}

export async function sendEmail(opts: {
  to: string
  toName: string
  subject: string
  bodyText: string
  senderName: string
  threadId?: string
}): Promise<{ id: string } | null> {
  try {
    const resend = getResend()
    const html   = buildEmailHtml({
      recipientName: opts.toName,
      subject:       opts.subject,
      bodyText:      opts.bodyText,
      senderName:    opts.senderName,
    })

    // reply+{threadId}@kiruajorix.resend.app so Resend routes the reply back to our webhook
    const replyTo = opts.threadId
      ? `reply+${opts.threadId}@${REPLY_DOMAIN}`
      : `support@${REPLY_DOMAIN}`

    const { data, error } = await resend.emails.send({
      from:     FROM_ADDRESS,
      to:       [opts.to],
      subject:  opts.subject,
      html,
      replyTo: replyTo,
    })

    if (error || !data) {
      console.error('[Resend] send error:', error)
      return null
    }
    return { id: data.id }
  } catch (err) {
    console.error('[Resend] send exception:', err)
    return null
  }
}
