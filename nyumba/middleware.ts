import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/security/rateLimit'

// Routes zinazohitaji login
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/saved', '/account', '/subscription', '/notifications', '/advertising/dashboard', '/advertising/new', '/advertising/pay', '/advertising/campaigns', '/advertising/profile', '/advertising/pending', '/fundi/dashboard', '/fundi/profile', '/fundi/kyc', '/fundi/jobs']
// Routes za watumiaji walioingia tu (usiende tena)
const AUTH_ROUTES = ['/login', '/register', '/staff-login']
// Routes za admin peke yake
const ADMIN_ONLY_ROUTES = ['/admin']
// Routes za wafanyabiashara — zinaelekeza /advertising/login badala ya /login
const ADVERTISING_PROTECTED_ROUTES = ['/advertising/dashboard', '/advertising/new', '/advertising/pay', '/advertising/campaigns', '/advertising/profile', '/advertising/pending']
// Routes za mafundi — zinaelekeza /fundi/login badala ya /login
const FUNDI_PROTECTED_ROUTES = ['/fundi/dashboard', '/fundi/profile', '/fundi/kyc', '/fundi/jobs']
// Routes za dalali na admin
const DALALI_ROUTES = ['/dashboard']
// Routes ambazo hazizuiwi na account_status au agreement check
const AGREEMENT_EXEMPT = [
  '/agreement-required',
  '/account-suspended',
  '/account-banned',
  '/auth/',
  '/api/',
  '/login',
  '/register',
]

// Helper: redirect while preserving Supabase-refreshed session cookies.
// Without this, Supabase cannot refresh tokens mid-session and users get logged out.
function redirectWithCookies(url: URL | string, supabaseResponse: NextResponse): NextResponse {
  const res = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    res.cookies.set(name, value, options)
  })
  return res
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Detect portal type from user_metadata (no extra DB query needed).
  // org_owner and tenant have their own consent flow inside the property portal
  // and must never be sent to the client/dalali /agreement-required page.
  const userMeta   = (user?.user_metadata ?? {}) as Record<string, string>
  const portalType = userMeta.portal_type ?? userMeta.role ?? ''
  const isOrgPortal = ['org_owner', 'tenant'].includes(portalType)

  const isProtected       = PROTECTED_ROUTES.some(r => path.startsWith(r))
  const needsRoleCheck    =
    ADMIN_ONLY_ROUTES.some(r => path.startsWith(r)) ||
    DALALI_ROUTES.some(r => path.startsWith(r))
  const isAgreementExempt  = AGREEMENT_EXEMPT.some(r => path.startsWith(r))
  // Advertising routes use a separate auth model (advertisers table + requireAdvertiserAuth).
  // They must NOT be run through the public.users role/agreement checks below — advertisers
  // are created with admin.createUser() which triggers handle_new_user and sets
  // agreement_accepted=false (the column default), causing a permanent redirect loop.
  const isAdvertisingRoute = ADVERTISING_PROTECTED_ROUTES.some(r => path.startsWith(r))
  // Fundi routes are guarded by (fundi)/layout.tsx — skip the dalali/admin agreement
  // and status checks here (fundi users are not in the same onboarding funnel).
  const isFundiRoute = FUNDI_PROTECTED_ROUTES.some(r => path.startsWith(r))

  // Redirect kwenda login kama hana session.
  // Admin paths → /staff-login (staff bookmarks land in the right portal).
  // All other protected paths → regular /login.
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    const isAdminPath       = ADMIN_ONLY_ROUTES.some(r => path.startsWith(r))
    const isAdvertisingPath = ADVERTISING_PROTECTED_ROUTES.some(r => path.startsWith(r))
    const isFundiPath       = FUNDI_PROTECTED_ROUTES.some(r => path.startsWith(r))
    url.pathname = isAdminPath ? '/staff-login' : isAdvertisingPath ? '/advertising/login' : isFundiPath ? '/fundi/login' : '/login'
    url.searchParams.set('redirect', path)
    return redirectWithCookies(url, supabaseResponse)
  }

  // ── MFA enforcement ─────────────────────────────────────────────────────────
  // If user has a verified TOTP factor and is only at AAL1, require AAL2 before
  // accessing protected routes. Skip for the MFA verify page itself and auth callbacks.
  const MFA_EXEMPT = ['/auth/mfa', '/auth/', '/api/', '/login', '/register', '/staff-login',
    '/advertising/login', '/fundi/login', '/portal/login', '/account/change-password']
  if (user && isProtected && !MFA_EXEMPT.some(p => path.startsWith(p))) {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/mfa'
        url.searchParams.set('redirect', path)
        return redirectWithCookies(url, supabaseResponse)
      }
    } catch { /* MFA check is non-fatal — let the request through */ }
  }

  // Email verification guard — all protected routes zinahitaji email iliyothibitishwa.
  // Admin/staff are exempt: their accounts are created by the platform operator with
  // confirmed credentials. Advertisers (/advertising/*) are also exempt because they
  // register via a server-side API and use the advertisers table (not users) — the
  // requireAdvertiserAuth guard handles their access control instead.
  if (user && !user.email_confirmed_at && isProtected) {
    if (!path.startsWith('/account/change-password')) {
      const isAdvertisingRoute = ADVERTISING_PROTECTED_ROUTES.some(r => path.startsWith(r))

      if (isAdvertisingRoute) {
        // Advertisers don't appear in the users table; auto-confirm so they can access
        // their dashboard. The API-layer requireAdvertiserAuth() is their access gate.
        try {
          const adminSup = createSupabaseAdmin(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { autoRefreshToken: false, persistSession: false } },
          )
          await adminSup.auth.admin.updateUserById(user.id, { email_confirm: true })
        } catch { /* non-fatal */ }
      } else {
        // Check role — admin and staff bypass the email-verification wall
        const { data: roleRow } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        const isPrivileged = roleRow?.role === 'admin' || roleRow?.role === 'staff'

        if (isPrivileged) {
          // Auto-confirm so subsequent requests pass without this extra query
          try {
            const adminSup = createSupabaseAdmin(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } },
            )
            await adminSup.auth.admin.updateUserById(user.id, { email_confirm: true })
          } catch { /* non-fatal — they still get through this request */ }
        } else {
          const url = request.nextUrl.clone()
          url.pathname = '/verify-email'
          url.searchParams.set('email', user.email ?? '')
          return redirectWithCookies(url, supabaseResponse)
        }
      }
    }
  }

  // Redirect kwenda role-appropriate page kama tayari ameingia
  // Use exact match — startsWith would incorrectly intercept /register/complete
  if (user && AUTH_ROUTES.includes(path)) {
    // Fast path for portal users — portalType already extracted at top of middleware
    if (portalType === 'org_owner') return redirectWithCookies(new URL('/property/dashboard', request.url), supabaseResponse)
    if (portalType === 'tenant')    return redirectWithCookies(new URL('/tenant', request.url), supabaseResponse)
    if (portalType === 'fundi')     return redirectWithCookies(new URL('/fundi/dashboard', request.url), supabaseResponse)

    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    const url = request.nextUrl.clone()
    url.pathname = me?.role === 'admin'  ? '/admin'
      : me?.role === 'staff'  ? '/admin/staff-dashboard'
      : me?.role === 'dalali' ? '/dashboard'
      : me?.role === 'fundi'  ? '/fundi/dashboard'
      : '/'
    return redirectWithCookies(url, supabaseResponse)
  }

  // Kwa routes zilizo na ulinzi — angalia is_active NA role kwa query moja.
  // Advertising routes skip this block entirely: their auth is enforced at the API layer
  // by requireAdvertiserAuth(), which checks the advertisers table directly.
  if (user && (isProtected || needsRoleCheck) && !isAdvertisingRoute && !isFundiRoute) {
    const { data: userData, error: profileErr } = await supabase
      .from('users')
      .select('role, is_active, staff_active, must_change_password, account_status, agreement_accepted')
      .eq('id', user.id)
      .single()

    // If the full query fails (e.g. a column doesn't yet exist in the DB),
    // fall back to the minimal columns that must always exist. This prevents
    // treating every user as 'client' and blocking admin/staff/dalali access.
    if (profileErr) {
      const { data: fallback } = await supabase
        .from('users')
        .select('role, is_active')
        .eq('id', user.id)
        .single()

      if (fallback?.is_active === false) {
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.delete('redirect')
        url.searchParams.set('suspended', '1')
        return redirectWithCookies(url, supabaseResponse)
      }

      const role = fallback?.role ?? 'client'
      if (ADMIN_ONLY_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'staff') {
        return redirectWithCookies(new URL('/', request.url), supabaseResponse)
      }
      if (DALALI_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'dalali') {
        return redirectWithCookies(new URL('/', request.url), supabaseResponse)
      }

      return supabaseResponse
    }

    // Akaunti iliyozimwa kabisa (is_active = false)
    if (userData?.is_active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.delete('redirect')
      url.searchParams.set('suspended', '1')
      return redirectWithCookies(url, supabaseResponse)
    }

    // Staff iliyozimwa na admin (staff_active = false)
    if (userData?.role === 'staff' && userData?.staff_active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.delete('redirect')
      url.searchParams.set('suspended', '1')
      return redirectWithCookies(url, supabaseResponse)
    }

    // Staff yenye must_change_password — lazima ibadilishe password kwanza
    if (
      userData?.role === 'staff' &&
      userData?.must_change_password &&
      !path.startsWith('/account/change-password') &&
      !path.startsWith('/api/')
    ) {
      return redirectWithCookies(new URL('/account/change-password', request.url), supabaseResponse)
    }

    // Akaunti iliyosimamishwa (account_status = suspended/banned)
    if (!isAgreementExempt) {
      if (userData?.account_status === 'suspended') {
        return redirectWithCookies(new URL('/account-suspended', request.url), supabaseResponse)
      }
      if (userData?.account_status === 'banned') {
        return redirectWithCookies(new URL('/account-banned', request.url), supabaseResponse)
      }

      // Makubaliano hayajasainiwa — admin, staff, na org/tenant portal wanapita bila kizuizi.
      // Org owners na tenants wana mfumo wao wa makubaliano ndani ya property portal;
      // hawafai kulazimishwa kukubali makubaliano ya client/dalali ya soko.
      const skipAgreement = userData?.role === 'admin' || userData?.role === 'staff' || isOrgPortal
      if (!skipAgreement && userData?.agreement_accepted === false) {
        return redirectWithCookies(new URL('/agreement-required', request.url), supabaseResponse)
      }
    }

    const role = userData?.role ?? 'client'

    // /admin/* → admin au staff tu (staff wanaingia, lakini pages zinazidi kuangalia permissions)
    if (ADMIN_ONLY_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'staff') {
      return redirectWithCookies(new URL('/', request.url), supabaseResponse)
    }

    // /dashboard/* → dalali na admin tu (staff wanaenda /admin/*, si /dashboard/*)
    if (DALALI_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'dalali') {
      return redirectWithCookies(new URL('/', request.url), supabaseResponse)
    }

    // /dashboard/analytics → basic plan au zaidi (si free)
    if (path.startsWith('/dashboard/analytics') && role === 'dalali') {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('dalali_id', user.id)
        .eq('status', 'active')
        .order('expires_at', { ascending: false })
        .maybeSingle()

      if (!sub || sub.plan === 'free') {
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard/subscription'
        url.searchParams.set('upgrade', 'analytics')
        return redirectWithCookies(url, supabaseResponse)
      }
    }
  }

  // ── Rate limiting for admin API routes ───────────────────────────────────
  // Applied at middleware level so ALL /api/v1/admin/* routes are protected
  // without needing per-route rate-limit code. 60 req/min per authenticated user.
  if (path.startsWith('/api/v1/admin/') && user) {
    const rl = await rateLimit(`mw:admin:${user.id}`, 60, 60_000)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Maombi mengi sana. Subiri kidogo.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
      )
    }
  }

  // ── Security headers on every response ───────────────────────────────────
  // Applied here once so every route gets them without per-route boilerplate.
  supabaseResponse.headers.set('X-Frame-Options', 'SAMEORIGIN')
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  supabaseResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload',
  )

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
