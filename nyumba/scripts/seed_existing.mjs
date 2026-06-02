// Seed data for existing users — node scripts/seed_existing.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

function ok(label, error) {
  if (error) { console.error(`  ✗ ${label}:`, error.message); return false }
  console.log(`  ✓ ${label}`)
  return true
}

async function run() {
  console.log('🌱 Seeding data for existing users...\n')

  // ── 1. Pata IDs za users kutoka public.users ──────────────
  console.log('🔍 Fetching user IDs...')
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, email, role')
    .in('email', ['admin@nyumba.co.tz', 'juma@dalali.co.tz', 'client@nyumba.co.tz'])

  if (usersErr || !users?.length) {
    console.error('✗ Imeshindwa kupata users:', usersErr?.message ?? 'hakuna data')
    process.exit(1)
  }

  const adminUser  = users.find(u => u.email === 'admin@nyumba.co.tz')
  const jumaUser   = users.find(u => u.email === 'juma@dalali.co.tz')
  const clientUser = users.find(u => u.email === 'client@nyumba.co.tz')

  console.log(`  ✓ admin  : ${adminUser?.id ?? 'HAIPO'}`)
  console.log(`  ✓ juma   : ${jumaUser?.id ?? 'HAIPO'}`)
  console.log(`  ✓ client : ${clientUser?.id ?? 'HAIPO'}`)

  if (!jumaUser || !clientUser) {
    console.error('\n✗ Juma au client hawapatikani kwenye public.users. Thibitisha walioingizwa.')
    process.exit(1)
  }

  // ── 2. dalali_profile kwa Juma ───────────────────────────
  console.log('\n👤 dalali_profiles...')
  const { error: dpErr } = await supabase.from('dalali_profiles').upsert(
    {
      user_id:             jumaUser.id,
      whatsapp_number:     '255712345678',
      bio:                 'Dalali wa miaka 5 Dar es Salaam. Najua maeneo yote ya Kinondoni, Ilala na Mbezi. Nipo karibu nawe wakati wote.',
      rating_avg:          4.7,
      rating_count:        23,
      is_premium_verified: true,
    },
    { onConflict: 'user_id' }
  )
  ok('dalali_profile (Juma)', dpErr)

  // ── 3. Subscription ya Premium kwa Juma ──────────────────
  console.log('\n💳 subscriptions...')
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('dalali_id', jumaUser.id)
    .eq('status', 'active')
    .maybeSingle()

  if (existingSub) {
    console.log('  ℹ️  subscription ya Juma ipo tayari — inaacha')
  } else {
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const { error: subErr } = await supabase.from('subscriptions').insert({
      dalali_id: jumaUser.id,
      plan:      'premium',
      status:    'active',
      order_id:  `SEED-JUMA-${Date.now()}`,
      expires_at: expires.toISOString(),
    })
    ok('subscription Premium (Juma, siku 30)', subErr)
  }

  // ── 4. Listings 3 za Juma ─────────────────────────────────
  console.log('\n🏠 listings...')

  // Angalia kama listings zipo tayari
  const { count: existingCount } = await supabase
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('dalali_id', jumaUser.id)

  if ((existingCount ?? 0) >= 3) {
    console.log(`  ℹ️  Listings ${existingCount} za Juma zipo tayari — zinaacha`)
  } else {
    const listingDefs = [
      {
        type:      'chumba',
        title:     'Chumba – Sinza',
        district:  'Sinza',
        region:    'Dar es Salaam',
        price:     150000,
        bedrooms:  1,
        furnished: 'empty',
        amenities: ['umeme', 'maji', 'daladala', 'soko'],
        description: 'Chumba kimoja chenye choo cha ndani, karibu na daladala na soko la Sinza. Bei nzuri kwa wanafunzi na wafanyakazi.',
        images: [
          'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80',
          'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80',
        ],
        is_boosted: false,
        view_count: 34,
        lead_count: 5,
      },
      {
        type:      'apartment',
        title:     'Apartment – Mbezi Beach',
        district:  'Mbezi Beach',
        region:    'Dar es Salaam',
        price:     450000,
        bedrooms:  2,
        furnished: 'semi',
        amenities: ['umeme', 'maji', 'wifi', 'parking', 'watchman'],
        description: 'Apartment ya ghorofa ya 2 eneo la Mbezi Beach. Mwanga mzuri, parking ya gari, karibu na bahari.',
        images: [
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
          'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80',
          'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',
        ],
        is_boosted: true,
        view_count: 87,
        lead_count: 12,
      },
      {
        type:      'nyumba',
        title:     'Nyumba – Mbezi Luis',
        district:  'Mbezi Luis',
        region:    'Dar es Salaam',
        price:     650000,
        bedrooms:  3,
        furnished: 'furnished',
        amenities: ['umeme', 'maji', 'wifi', 'parking', 'watchman', 'ac', 'dstv', 'generator'],
        description: 'Nyumba nzuri sana yenye vyumba 3 vya kulala, saloon kubwa, jiko la kisasa. Yenye samani zote na watchman 24/7.',
        images: [
          'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&q=80',
          'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',
        ],
        is_boosted: true,
        view_count: 112,
        lead_count: 18,
      },
    ]

    const insertedListingIds = []
    for (const l of listingDefs) {
      const { data: listing, error: lErr } = await supabase
        .from('listings')
        .insert({
          dalali_id:     jumaUser.id,
          title:         l.title,
          type:          l.type,
          status:        'active',
          price_monthly: l.price,
          district:      l.district,
          region:        l.region,
          furnished:     l.furnished,
          amenities:     l.amenities,
          images:        l.images,
          description:   l.description,
          bedrooms:      l.bedrooms,
          is_boosted:    l.is_boosted,
          view_count:    l.view_count,
          lead_count:    l.lead_count,
        })
        .select('id')
        .single()
      if (ok(`${l.title} — Tsh ${(l.price / 1000).toFixed(0)}k`, lErr)) {
        insertedListingIds.push(listing.id)
      }
    }

    // ── 5. Saved listings kwa client ───────────────────────
    if (insertedListingIds.length >= 2) {
      console.log('\n❤️  saved_listings...')
      for (const lid of insertedListingIds.slice(0, 2)) {
        const { error: svErr } = await supabase.from('saved_listings').upsert(
          { user_id: clientUser.id, listing_id: lid },
          { onConflict: 'user_id,listing_id' }
        )
        ok(`saved_listing (client → ${lid.slice(0, 8)}...)`, svErr)
      }
    }
  }

  // ── 6. Notifications ──────────────────────────────────────
  console.log('\n🔔 notifications...')

  // Angalia kama zipo tayari
  const { count: notifCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('user_id', [jumaUser.id, clientUser.id])

  if ((notifCount ?? 0) >= 2) {
    console.log('  ℹ️  Notifications zipo tayari — zinaacha')
  } else {
    const notifs = [
      {
        user_id: jumaUser.id,
        title:   'Listing yako imeidhinishwa! ✓',
        body:    'Apartment – Mbezi Beach imeidhinishwa na admin. Wateja wanaweza kuiona sasa.',
        type:    'listing_approved',
        is_read: false,
        data:    { listing_title: 'Apartment – Mbezi Beach' },
      },
      {
        user_id: clientUser.id,
        title:   'Karibu Nyumba! 🏠',
        body:    'Akaunti yako imefanikiwa kuundwa. Tafuta nyumba au chumba unachokitaka.',
        type:    'welcome',
        is_read: false,
        data:    null,
      },
    ]
    for (const n of notifs) {
      const { error: nErr } = await supabase.from('notifications').insert(n)
      ok(`notification → ${n.user_id === jumaUser.id ? 'Juma' : 'client'}: "${n.title}"`, nErr)
    }
  }

  // ── 7. Verification: count per table ─────────────────────
  console.log('\n📊 Verification — record counts:')
  const tables = ['users', 'dalali_profiles', 'subscriptions', 'listings', 'saved_listings', 'notifications']
  for (const t of tables) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`  ${t.padEnd(20)} ✗ ${error.message}`)
    } else {
      console.log(`  ${t.padEnd(20)} ${count} records`)
    }
  }

  console.log('\n✅ Done!\n')
}

run().catch(console.error)
