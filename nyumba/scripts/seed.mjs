/**
 * Nyumba seed script
 * Run from the nyumba/ directory:  node scripts/seed.mjs
 *
 * Does NOT call auth.admin API (unavailable on all Supabase plans).
 * Reads existing users from public.users, then upserts profiles,
 * subscriptions, listings, saved_listings and notifications.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── env loading ───────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../.env.local')

if (!existsSync(envPath)) {
  console.error('✗ .env.local not found at', envPath)
  console.error('  Create it and add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function log(ok, label, extra = '') {
  if (ok) console.log(`  ✓ ${label}${extra ? ' — ' + extra : ''}`)
  else     console.error(`  ✗ ${label}`)
}

// ── helpers ───────────────────────────────────────────────────
async function getUsersByRole() {
  const { data, error } = await supabase
    .from('users')
    .select('id, phone, full_name, role')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('✗ Imeshindwa kusoma public.users:', error.message)
    process.exit(1)
  }
  return data ?? []
}

async function ensureSubscription(dalaliId, plan) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id, plan, status, expires_at')
    .eq('dalali_id', dalaliId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    console.log(`    ℹ subscription ipo tayari (${existing.plan}, inaisha ${existing.expires_at?.slice(0,10)})`)
    return existing.id
  }

  const starts  = new Date()
  const expires = new Date(starts)
  expires.setDate(expires.getDate() + 30)

  const { data, error } = await supabase.from('subscriptions').insert({
    dalali_id:      dalaliId,
    plan,
    status:         'active',
    amount_paid:    plan === 'premium' ? 25000 : 10000,
    payment_method: 'mpesa',
    payment_ref:    `SEED-${dalaliId.slice(0, 8)}-${Date.now()}`,
    starts_at:      starts.toISOString(),
    expires_at:     expires.toISOString(),
    auto_renew:     false,
  }).select('id').single()

  log(!error, `subscription ${plan} (30 days)`, error?.message)
  return data?.id ?? null
}

async function ensureListings(dalaliId, defs) {
  const { count } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('dalali_id', dalaliId)
    .in('status', ['active', 'pending'])

  if ((count ?? 0) > 0) {
    console.log(`    ℹ listings zipo tayari (${count}) — zinaacha`)
    // Return their IDs for use in saved_listings
    const { data } = await supabase.from('listings').select('id').eq('dalali_id', dalaliId).limit(3)
    return (data ?? []).map(l => l.id)
  }

  const ids = []
  for (const l of defs) {
    const { data, error } = await supabase.from('listings').insert({
      dalali_id:     dalaliId,
      type:          l.type,
      title:         l.title,
      status:        'active',
      price_monthly: l.price,
      district:      l.district,
      region:        l.region,
      furnished:     l.furnished,
      amenities:     l.amenities,
      images:        l.images,
      description:   l.description,
      bedrooms:      l.bedrooms ?? null,
      is_boosted:    l.is_boosted ?? false,
      view_count:    l.view_count ?? 0,
      lead_count:    l.lead_count ?? 0,
    }).select('id').single()
    log(!error, `${l.title}`, error?.message ?? `Tsh ${(l.price / 1000).toFixed(0)}k`)
    if (data) ids.push(data.id)
  }
  return ids
}

async function ensureSavedListings(clientId, listingIds) {
  const { count } = await supabase
    .from('saved_listings')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if ((count ?? 0) >= listingIds.length) {
    console.log(`    ℹ saved_listings zipo tayari (${count})`)
    return
  }

  for (const lid of listingIds) {
    const { error } = await supabase.from('saved_listings')
      .upsert({ client_id: clientId, listing_id: lid }, { onConflict: 'client_id,listing_id' })
    log(!error, `saved_listing → ${lid.slice(0, 8)}...`, error?.message)
  }
}

async function ensureNotifications(userId, notifs) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) > 0) {
    console.log(`    ℹ notifications zipo tayari (${count})`)
    return
  }

  for (const n of notifs) {
    const { error } = await supabase.from('notifications').insert({ user_id: userId, ...n })
    log(!error, `notification: "${n.title}"`, error?.message)
  }
}

// ── main ──────────────────────────────────────────────────────
async function run() {
  console.log('🌱 Nyumba Seed Script\n')

  // ── Step 1: Read existing users ──────────────────────────
  console.log('👤 Kusoma users kutoka public.users...')
  const allUsers = await getUsersByRole()

  if (allUsers.length === 0) {
    console.error('\n✗ Hakuna users kwenye public.users.')
    console.error('  Weka users kwanza kupitia Supabase Dashboard → Authentication → Users')
    console.error('  au ingiza moja kwa moja kwenye public.users kupitia SQL Editor.')
    process.exit(1)
  }

  const dalalis = allUsers.filter(u => u.role === 'dalali')
  const clients = allUsers.filter(u => u.role === 'client')
  const admins  = allUsers.filter(u => u.role === 'admin')

  console.log(`  ✓ Users ${allUsers.length} wamepatikana: dalali=${dalalis.length}, client=${clients.length}, admin=${admins.length}`)

  allUsers.forEach(u => {
    console.log(`    • ${u.full_name.padEnd(20)} role=${u.role.padEnd(6)} id=${u.id}`)
  })

  if (dalalis.length === 0) {
    console.error('\n✗ Hakuna dalali kwenye public.users — seed haitaweza kuendelea.')
    process.exit(1)
  }

  // ── Step 2: dalali_profiles ────────────────────────────────
  console.log('\n👤 dalali_profiles...')
  const profileDefs = [
    {
      whatsapp: '255712345678',
      bio: 'Dalali wa miaka 5 Dar es Salaam. Najua maeneo yote ya Kinondoni, Ilala na Mbezi Beach. Jibu la haraka linalihakikishiwa.',
      rating: 4.7, count: 31, verified: true,
      areas: ['Kinondoni', 'Mbezi', 'Sinza'],
    },
    {
      whatsapp: '255756789012',
      bio: 'Napatikana Arusha na Moshi. Vyumba na apartments za bei nzuri kwa wote.',
      rating: 4.2, count: 14, verified: false,
      areas: ['Njiro', 'Arusha CBD', 'Moshi'],
    },
    {
      whatsapp: '255744123456',
      bio: 'Dalali wa Dar es Salaam, eneo la Temeke na Ilala. Nipo karibu nawe.',
      rating: 3.9, count: 8, verified: false,
      areas: ['Temeke', 'Ilala', 'Kariakoo'],
    },
  ]

  for (let i = 0; i < dalalis.length; i++) {
    const d = dalalis[i]
    const p = profileDefs[i] ?? profileDefs[profileDefs.length - 1]
    const { error } = await supabase.from('dalali_profiles').upsert(
      {
        user_id:             d.id,
        whatsapp_number:     p.whatsapp,
        bio:                 p.bio,
        rating_avg:          p.rating,
        rating_count:        p.count,
        is_premium_verified: p.verified,
        operating_areas:     p.areas,
      },
      { onConflict: 'user_id' }
    )
    log(!error, `profile: ${d.full_name} (rating ${p.rating})`, error?.message)
  }

  // ── Step 3: subscriptions ─────────────────────────────────
  console.log('\n💳 subscriptions...')
  const plans = ['premium', 'premium', 'basic']
  const listingIds = []

  for (let i = 0; i < dalalis.length; i++) {
    const d = dalalis[i]
    console.log(`  → ${d.full_name}`)
    await ensureSubscription(d.id, plans[i] ?? 'basic')
  }

  // ── Step 4: listings ──────────────────────────────────────
  console.log('\n🏠 listings...')
  const firstDalali = dalalis[0]
  console.log(`  → ${firstDalali.full_name}`)

  const firstListingIds = await ensureListings(firstDalali.id, [
    {
      type: 'chumba', title: 'Chumba – Sinza', district: 'Sinza', region: 'Dar es Salaam',
      price: 150000, bedrooms: 1, furnished: 'empty',
      amenities: ['umeme', 'maji', 'daladala', 'soko'],
      description: 'Chumba kimoja chenye choo cha ndani, karibu na daladala na soko la Sinza. Bei nzuri kwa wanafunzi na wafanyakazi.',
      images: [
        'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
      ],
      is_boosted: false, view_count: 34, lead_count: 5,
    },
    {
      type: 'apartment', title: 'Apartment – Mbezi Beach', district: 'Mbezi Beach', region: 'Dar es Salaam',
      price: 450000, bedrooms: 2, furnished: 'semi',
      amenities: ['umeme', 'maji', 'wifi', 'parking', 'watchman'],
      description: 'Apartment ya ghorofa ya 2 eneo la Mbezi Beach. Mwanga mzuri, parking ya gari, karibu na bahari.',
      images: [
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
      ],
      is_boosted: true, view_count: 87, lead_count: 12,
    },
    {
      type: 'nyumba', title: 'Nyumba – Mbezi Luis', district: 'Mbezi Luis', region: 'Dar es Salaam',
      price: 650000, bedrooms: 3, furnished: 'furnished',
      amenities: ['umeme', 'maji', 'wifi', 'parking', 'watchman', 'ac', 'dstv', 'generator'],
      description: 'Nyumba nzuri sana yenye vyumba 3 vya kulala, saloon kubwa, jiko la kisasa na dari. Yenye samani zote, generator, watchman 24/7.',
      images: [
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&q=80',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
      ],
      is_boosted: true, view_count: 112, lead_count: 18,
    },
  ])
  listingIds.push(...firstListingIds)

  if (dalalis.length > 1) {
    console.log(`  → ${dalalis[1].full_name}`)
    const ids2 = await ensureListings(dalalis[1].id, [
      {
        type: 'apartment', title: 'Apartment – Njiro', district: 'Njiro', region: 'Arusha',
        price: 250000, bedrooms: 2, furnished: 'semi',
        amenities: ['umeme', 'maji', 'wifi'],
        description: 'Apartment nzuri Njiro Arusha. Karibu na shule na hospitali.',
        images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80'],
        is_boosted: false, view_count: 21, lead_count: 3,
      },
      {
        type: 'chumba', title: 'Chumba – Manzese', district: 'Manzese', region: 'Dar es Salaam',
        price: 60000, bedrooms: 1, furnished: 'empty',
        amenities: ['umeme', 'maji', 'daladala', 'soko'],
        description: 'Chumba bei nafuu Manzese. Karibu na soko na daladala.',
        images: ['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80'],
        is_boosted: false, view_count: 19, lead_count: 2,
      },
    ])
    listingIds.push(...ids2)
  }

  // ── Step 5: saved_listings ────────────────────────────────
  if (clients.length > 0 && listingIds.length >= 2) {
    console.log('\n❤️  saved_listings...')
    const client = clients[0]
    console.log(`  → ${client.full_name}`)
    await ensureSavedListings(client.id, listingIds.slice(0, 2))
  }

  // ── Step 6: notifications ─────────────────────────────────
  console.log('\n🔔 notifications...')
  if (dalalis.length > 0) {
    console.log(`  → ${dalalis[0].full_name}`)
    await ensureNotifications(dalalis[0].id, [
      { type: 'listing_approved', title: 'Listing yako imeidhinishwa! ✓',
        body: 'Nyumba – Mbezi Luis ipo live sasa. Wateja wanaweza kuiona.', is_read: false },
      { type: 'unlock', title: 'Mtu amefungua mawasiliano yako!',
        body: 'Client mpya anataka kukuwasiliana nawe. Angalia dashibodi yako.', is_read: false },
    ])
  }
  if (clients.length > 0) {
    console.log(`  → ${clients[0].full_name}`)
    await ensureNotifications(clients[0].id, [
      { type: 'welcome', title: 'Karibu Nyumba! 🏠',
        body: 'Akaunti yako imefanikiwa kuundwa. Tafuta nyumba au chumba unachokitaka.', is_read: false },
      { type: 'new_listing', title: 'Listing mpya karibu nawe!',
        body: 'Chumba kipya kimetokea katika eneo unalotaka — bei Tsh 150,000.', is_read: false },
    ])
  }

  // ── Step 7: Verification ──────────────────────────────────
  console.log('\n📊 Verification — record counts:')
  const tables = ['users', 'dalali_profiles', 'subscriptions', 'listings', 'saved_listings', 'notifications']
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t.padEnd(22)} ${error ? '✗ ' + error.message : count + ' records'}`)
  }

  console.log('\n✅ Seed complete!\n')
  console.log('🌐 Open: http://localhost:3000')
}

run().catch(err => {
  console.error('\n✗ Fatal error:', err.message)
  process.exit(1)
})
