/**
 * patch_public_users.mjs
 * Weka roles sahihi kwenye public.users kwa test users walioundwa sasa hivi.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dir, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { id: '98b2fa81-daf3-480d-94b0-d3552ddf1cd8', full_name: 'Admin Nyumba', role: 'admin' },
  { id: '996921f6-a63e-45c2-b645-1a69e86d4bac', full_name: 'Juma Dalali',  role: 'dalali' },
  { id: 'dda0d937-7b2c-4268-9d51-017461ca0fd8', full_name: 'Client Test',  role: 'client' },
]

for (const u of USERS) {
  const { error } = await db.from('users').upsert(
    { id: u.id, phone: null, full_name: u.full_name, role: u.role },
    { onConflict: 'id' }
  )
  if (error) console.error(`❌ ${u.full_name}: ${error.message}`)
  else console.log(`✅ ${u.full_name} (${u.role}) — public.users ok`)
}

// Verify
const { data } = await db.from('users')
  .select('id, full_name, role')
  .in('id', USERS.map(u => u.id))
console.log('\nVerification:')
data?.forEach(u => console.log(`  ${u.full_name.padEnd(16)} role=${u.role}`))
