import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

function nameToSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 16) || 'broker'
}

function randomSuffix(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// GET /api/v1/admin/brokers
// List all NyumbaFasta platform broker accounts
export async function GET() {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('dalali_profiles')
      .select(`
        user_id,
        broker_whatsapp,
        whatsapp_number,
        is_verified,
        subscription_plan,
        created_at,
        broker_user:users!user_id(id, full_name, email, phone, username, created_at)
      `)
      .eq('is_platform_broker', true)
      .order('created_at', { ascending: true })

    if (error) throw error

    return NextResponse.json({ brokers: data ?? [] })
  } catch (err) {
    console.error('[GET /admin/brokers]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}

// POST /api/v1/admin/brokers
// Create a new NyumbaFasta platform broker account
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminAuth()
    if (!auth.ok) return auth.response

    const admin = createAdminClient()
    const { full_name, email, password, whatsapp_number } = await req.json()

    if (!full_name?.trim()) return NextResponse.json({ error: 'Jina linahitajika' }, { status: 400 })
    if (!email?.trim())     return NextResponse.json({ error: 'Barua pepe inahitajika' }, { status: 400 })
    if (!password || password.length < 8)
      return NextResponse.json({ error: 'Nenosiri lazima liwe na herufi 8 au zaidi' }, { status: 400 })
    if (!whatsapp_number?.trim())
      return NextResponse.json({ error: 'Nambari ya WhatsApp inahitajika' }, { status: 400 })

    // 1. Create Supabase Auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email:          email.trim().toLowerCase(),
      password,
      email_confirm:  true,
      user_metadata:  { full_name: full_name.trim(), role: 'dalali' },
    })

    if (authErr) {
      if (authErr.message.includes('already registered') || authErr.message.includes('already been registered')) {
        return NextResponse.json({ error: 'Barua pepe hii tayari ipo' }, { status: 409 })
      }
      throw authErr
    }

    const userId = authData.user.id

    // 2. Upsert into public.users with role=staff so they can access the staff dashboard
    await admin.from('users').upsert({
      id:        userId,
      full_name: full_name.trim(),
      email:     email.trim().toLowerCase(),
      role:      'staff',
    }, { onConflict: 'id' })

    // 3. Create dalali_profiles with platform broker flag (needed for posting listings)
    const { data: profile, error: profileErr } = await admin
      .from('dalali_profiles')
      .upsert({
        user_id:            userId,
        is_platform_broker: true,
        broker_whatsapp:    whatsapp_number.trim(),
        whatsapp_number:    whatsapp_number.trim(),
        is_verified:        true,
        subscription_plan:  'premium',
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (profileErr) throw profileErr

    // 4. Auto-grant brokerage staff permission so the staff dashboard shows the brokerage tab
    await admin.from('staff_permissions').upsert(
      { staff_id: userId, permission_key: 'brokerage' },
      { onConflict: 'staff_id, permission_key' }
    )

    // 5. Auto-generate microsite username — broker gets /agent/{username} link automatically
    const base = nameToSlug(full_name.trim())
    let generatedUsername: string | null = null
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${base}_${randomSuffix()}`
      const { data: taken } = await admin.from('users').select('id').eq('username', candidate).maybeSingle()
      if (taken) continue
      const { error: usernameErr } = await admin.from('users').update({ username: candidate }).eq('id', userId)
      if (!usernameErr) { generatedUsername = candidate; break }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.nyumbafasta.co'
    return NextResponse.json({
      broker:     { user_id: userId, ...profile },
      username:   generatedUsername,
      microsite:  generatedUsername ? `${appUrl}/agent/${generatedUsername}` : null,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /admin/brokers]', err)
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
