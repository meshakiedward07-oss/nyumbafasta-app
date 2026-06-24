import { type NextRequest } from 'next/server'
import { verifyMarkTakenToken, markListingAsTakenByToken } from '@/lib/listings/rentalReminder'

// GET — one-click link sent in WhatsApp reminder message
// No session required; security comes from HMAC token signed with CRON_SECRET.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const unlockId = searchParams.get('unlock') ?? ''
  const token    = searchParams.get('token') ?? ''

  if (!unlockId || !token) {
    return html('error', 'Kiungo si sahihi au kimekwisha.')
  }

  if (!verifyMarkTakenToken(params.id, unlockId, token)) {
    return html('error', 'Kiungo si sahihi au kimekwisha.')
  }

  const result = await markListingAsTakenByToken(params.id, unlockId)

  if (result.alreadyTaken) {
    return html('already', 'Listing hii tayari imefungwa.')
  }
  if (!result.success) {
    return html('error', result.error ?? 'Imeshindwa kufunga listing.')
  }

  return html('success', 'Listing yako imefungwa. Wateja hawataiona tena.')
}

// ── Simple branded HTML page returned to dalali's browser ─────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

type PageType = 'success' | 'error' | 'already'

function html(type: PageType, message: string): Response {
  const cfg = {
    success: { emoji: '✅', title: 'Imefanikiwa!',     color: '#16a34a', bg: '#f0fdf4' },
    error:   { emoji: '❌', title: 'Imeshindwa',       color: '#dc2626', bg: '#fef2f2' },
    already: { emoji: 'ℹ️', title: 'Tayari Imefungwa', color: '#2563eb', bg: '#eff6ff' },
  }[type]

  const body = `<!DOCTYPE html>
<html lang="sw">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${cfg.title} — NyumbaFasta</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#f9fafb;padding:1.5rem}
    .card{background:#fff;border-radius:1.5rem;padding:2.5rem 2rem;
      text-align:center;max-width:360px;width:100%;
      box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .emoji{font-size:3rem;margin-bottom:1rem}
    .title{font-size:1.25rem;font-weight:700;color:${cfg.color};margin-bottom:.5rem}
    .msg{font-size:.9rem;color:#6b7280;line-height:1.6;margin-bottom:1.5rem}
    .badge{display:inline-block;background:${cfg.bg};color:${cfg.color};
      font-size:.8rem;font-weight:600;padding:.4rem 1.25rem;
      border-radius:999px;margin-bottom:1.5rem}
    .btn{display:block;background:#1D9E75;color:#fff;text-decoration:none;
      padding:.9rem 1.5rem;border-radius:.875rem;font-size:.9rem;font-weight:600}
    .brand{margin-top:1.25rem;font-size:.75rem;color:#9ca3af}
  </style>
</head>
<body>
  <div class="card">
    <div class="emoji">${cfg.emoji}</div>
    <h1 class="title">${cfg.title}</h1>
    <p class="msg">${message}</p>
    <div class="badge">NyumbaFasta</div>
    <a href="${APP_URL}/dashboard/listings" class="btn">Rudi Dashboard</a>
    <p class="brand">nyumbafasta.co</p>
  </div>
</body>
</html>`

  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
