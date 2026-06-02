/**
 * reset_test_users.mjs
 * Unda test users kwa signUp API (inafanya kazi, tofauti na admin API).
 * Tumia baada ya kurun delete_fake_users.sql kwenye Supabase SQL Editor.
 *
 * Tumia: node scripts/reset_test_users.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const URL_  = env.NEXT_PUBLIC_SUPABASE_URL
const ANON  = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVCR  = env.SUPABASE_SERVICE_ROLE_KEY

if (!URL_ || !ANON || !SVCR) {
  console.error('❌  Env vars hazipo kwenye .env.local')
  process.exit(1)
}

// Anon client — kwa signUp (inafanya kazi)
const auth = createClient(URL_, ANON, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Service role client — kwa DB writes (bypasses RLS)
const db = createClient(URL_, SVCR, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_USERS = [
  { email: 'admin@nyumba.co.tz',  password: 'Admin1234!',  role: 'admin',  full_name: 'Admin Nyumba' },
  { email: 'juma@dalali.co.tz',   password: 'Dalali1234!', role: 'dalali', full_name: 'Juma Dalali'  },
  { email: 'client@nyumba.co.tz', password: 'Client1234!', role: 'client', full_name: 'Client Test'  },
]

async function createUser({ email, password, role, full_name }) {
  console.log(`\n── ${email} (${role}) ──`)

  // 1. signUp — goes through /auth/v1/signup (works even when admin API fails)
  const { data, error } = await auth.auth.signUp({
    email,
    password,
    options: { data: { full_name, role } },
  })

  if (error) {
    console.error(`  ❌ signUp: ${error.message}`)
    console.log(`  ℹ️  Kama user yupo tayari: Supabase Dashboard → Auth → Users → Reset Password`)
    return null
  }

  const userId = data.user?.id
  if (!userId) {
    console.error('  ❌ signUp ilifanikiwa lakini hakuna user ID')
    return null
  }

  console.log(`  ✅ auth.users — created (${userId})`)

  // 2. Upsert public.users with correct role (trigger may set role='client' by default)
  const { error: dbErr } = await db.from('users').upsert(
    { id: userId, phone: null, full_name, role },
    { onConflict: 'id' }
  )
  if (dbErr) console.warn(`  ⚠️  public.users: ${dbErr.message}`)
  else console.log(`  ✅ public.users — role=${role}, full_name=${full_name}`)

  // 3. dalali_profiles
  if (role === 'dalali') {
    const { error: profErr } = await db.from('dalali_profiles').upsert(
      {
        user_id: userId,
        whatsapp_number: '255712000001',
        bio: 'Dalali wa nyumba Dar es Salaam — Msasani, Mbezi, Kinondoni.',
        rating_avg: 4.7,
        rating_count: 12,
        is_premium_verified: true,
      },
      { onConflict: 'user_id' }
    )
    if (profErr) console.warn(`  ⚠️  dalali_profiles: ${profErr.message}`)
    else console.log(`  ✅ dalali_profiles — ok`)
  }

  return userId
}

// ── Run ─────────────────────────────────────────────────────────
console.log('🔄  Inaunda test users kwa signUp API...')
console.log('    (Hakikisha umekwisha run delete_fake_users.sql kwanza)\n')

let ok = 0
for (const u of TEST_USERS) {
  const id = await createUser(u).catch(err => {
    console.error(`  ❌ ${u.email}: ${err.message}`)
    return null
  })
  if (id) ok++
}

console.log(`\n${'─'.repeat(50)}`)
console.log(`✅  Imekamilika: ${ok}/${TEST_USERS.length} users\n`)
console.log('Login credentials:')
TEST_USERS.forEach(u =>
  console.log(`  ${u.email.padEnd(28)} ${u.password.padEnd(14)} → ${
    u.role === 'admin' ? '/admin' : u.role === 'dalali' ? '/dashboard' : '/'
  }`)
)
