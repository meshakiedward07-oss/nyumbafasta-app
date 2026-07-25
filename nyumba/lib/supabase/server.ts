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
// Uses the Supabase connection pooler URL (SUPABASE_DB_URL with ?pgbouncer=true
// &connection_limit=1) when available to prevent exhausting Postgres connections
// in a serverless environment where every cold start opens a new connection.
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
        // Set SUPABASE_DB_URL to your Session-mode pooler URL from the Supabase
        // dashboard → Settings → Database → Connection pooling (Session mode).
        // This lets PgBouncer multiplex connections across serverless instances.
        schema: 'public',
      },
    }
  )
}
