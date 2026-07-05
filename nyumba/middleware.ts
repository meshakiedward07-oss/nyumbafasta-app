import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes zinazohitaji login
const PROTECTED_ROUTES = ['/dashboard', '/admin', '/saved', '/account', '/subscription', '/notifications']
// Routes za watumiaji walioingia tu (usiende tena)
const AUTH_ROUTES = ['/login', '/register']
// Routes za admin peke yake
const ADMIN_ONLY_ROUTES = ['/admin']
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
  const isAgreementExempt = AGREEMENT_EXEMPT.some(r => path.startsWith(r))

  // Redirect kwenda login kama hana session
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // Email verification guard — all protected routes zinahitaji email iliyothibitishwa
  // Google/OAuth users wana email_confirmed_at tayari; change-password exempt (recovery session)
  if (user && !user.email_confirmed_at && isProtected) {
    if (!path.startsWith('/account/change-password')) {
      const url = request.nextUrl.clone()
      url.pathname = '/verify-email'
      url.searchParams.set('email', user.email ?? '')
      return NextResponse.redirect(url)
    }
  }

  // Redirect kwenda role-appropriate page kama tayari ameingia
  if (user && AUTH_ROUTES.some(r => path.startsWith(r))) {
    const { data: me } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    const url = request.nextUrl.clone()
    url.pathname = me?.role === 'admin'  ? '/admin'
      : me?.role === 'staff'  ? '/admin/staff-leads'
      : me?.role === 'dalali' ? '/dashboard'
      : '/'
    return NextResponse.redirect(url)
  }

  // Kwa routes zilizo na ulinzi — angalia is_active NA role kwa query moja
  if (user && (isProtected || needsRoleCheck)) {
    const { data: userData } = await supabase
      .from('users')
      .select('role, is_active, staff_active, must_change_password, account_status, agreement_accepted')
      .eq('id', user.id)
      .single()

    // Akaunti iliyozimwa kabisa (is_active = false)
    if (userData?.is_active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.delete('redirect')
      url.searchParams.set('suspended', '1')
      return NextResponse.redirect(url)
    }

    // Staff iliyozimwa na admin (staff_active = false)
    if (userData?.role === 'staff' && userData?.staff_active === false) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.delete('redirect')
      url.searchParams.set('suspended', '1')
      return NextResponse.redirect(url)
    }

    // Staff yenye must_change_password — lazima ibadilishe password kwanza
    if (
      userData?.role === 'staff' &&
      userData?.must_change_password &&
      !path.startsWith('/account/change-password') &&
      !path.startsWith('/api/')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/account/change-password'
      return NextResponse.redirect(url)
    }

    // Akaunti iliyosimamishwa (account_status = suspended/banned)
    if (!isAgreementExempt) {
      if (userData?.account_status === 'suspended') {
        const url = request.nextUrl.clone()
        url.pathname = '/account-suspended'
        return NextResponse.redirect(url)
      }
      if (userData?.account_status === 'banned') {
        const url = request.nextUrl.clone()
        url.pathname = '/account-banned'
        return NextResponse.redirect(url)
      }

      // Makubaliano hayajasainiwa — admin wanapita bila kizuizi
      if (userData?.role !== 'admin' && userData?.agreement_accepted === false) {
        const url = request.nextUrl.clone()
        url.pathname = '/agreement-required'
        return NextResponse.redirect(url)
      }
    }

    const role = userData?.role ?? 'client'

    // /admin/* → admin au staff tu (staff wanaingia, lakini pages zinazidi kuangalia permissions)
    if (ADMIN_ONLY_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'staff') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // /dashboard/* → dalali na admin tu (staff wanaenda /admin/*, si /dashboard/*)
    if (DALALI_ROUTES.some(r => path.startsWith(r)) && role !== 'admin' && role !== 'dalali') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
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
        return NextResponse.redirect(url)
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
