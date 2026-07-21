import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

// Routes zinazohitaji login
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/saved', '/account', '/subscription', '/notifications', '/advertising/dashboard', '/advertising/new', '/advertising/pay', '/advertising/campaigns', '/advertising/profile']
// Routes za watumiaji walioingia tu (usiende tena)
const AUTH_ROUTES = ['/login', '/register', '/staff-login']
// Routes za admin peke yake
const ADMIN_ONLY_ROUTES = ['/admin']
// Routes za wafanyabiashara — zinaelekeza /advertising/login badala ya /login
const ADVERTISING_PROTECTED_ROUTES = ['/advertising/dashboard', '/advertising/new', '/advertising/pay', '/advertising/campaigns', '/advertising/profile']
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

  // Redirect kwenda login kama hana session.
  // Admin paths → /staff-login (staff bookmarks land in the right portal).
  // All other protected paths → regular /login.
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    const isAdminPath       = ADMIN_ONLY_ROUTES.some(r => path.startsWith(r))
    const isAdvertisingPath = ADVERTISING_PROTECTED_ROUTES.some(r => path.startsWith(r))
    url.pathname = isAdminPath ? '/staff-login' : isAdvertisingPath ? '/advertising/login' : '/login'
    url.searchParams.set('redirect', path)
    return redirectWithCookies(url, supabaseResponse)
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
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    const url = request.nextUrl.clone()
    url.pathname = me?.role === 'admin'  ? '/admin'
      : me?.role === 'staff'  ? '/admin/staff-dashboard'
      : me?.role === 'dalali' ? '/dashboard'
      : '/'
    return redirectWithCookies(url, supabaseResponse)
  }

  // Kwa routes zilizo na ulinzi — angalia is_active NA role kwa query moja.
  // Advertising routes skip this block entirely: their auth is enforced at the API layer
  // by requireAdvertiserAuth(), which checks the advertisers table directly.
  if (user && (isProtected || needsRoleCheck) && !isAdvertisingRoute) {
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

      // Makubaliano hayajasainiwa — admin NA staff wanapita bila kizuizi
      // (staff hawana haja ya kusaini agreement ya client/dalali)
      const skipAgreement = userData?.role === 'admin' || userData?.role === 'staff'
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

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
