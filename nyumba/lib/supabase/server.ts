import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — ignored
          }
        },
      },
    }
  )
}

// Uses @supabase/supabase-js directly so the service role key is always sent
// as the Authorization header — never overridden by user session cookies.
//
// NOTE (corrected 2026-08-30 — a scalability audit found the previous
// comment here described a PgBouncer/SUPABASE_DB_URL pooling setup that was
// never actually implemented, and structurally couldn't be via this client:
// @supabase/supabase-js talks to Supabase's PostgREST HTTP API, not a raw
// Postgres wire connection — createClient() doesn't accept a connection
// string at all (confirmed: SUPABASE_DB_URL is not read anywhere in this
// codebase). There is nothing for THIS code to pool — every request here is
// one HTTP call to PostgREST, and Postgres connection-limit management for
// those calls is entirely Supabase's managed pooling layer on their side,
// not something configured from the app. If connection-ceiling issues ever
// show up at high concurrency, look at the Supabase project's own
// pooler/plan settings, not this function.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    }
  )
}
