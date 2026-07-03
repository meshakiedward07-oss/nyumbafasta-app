import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const maxDuration = 15

// Builds a url-safe base from the dalali's full name
function nameToSlug(fullName: string): string {
  return fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 16)
    || 'dalali'
}

// 5-char random alphanumeric suffix — keeps usernames unique and non-guessable
function randomSuffix(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'  // no l,o,i,0,1 (confusing)
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// POST — auto-assign a unique username to the calling dalali if they don't have one
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })

    const admin = createAdminClient()
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nyumbafasta.co'

    // Fetch current user record
    const { data: me } = await admin
      .from('users')
      .select('role, full_name, username')
      .eq('id', user.id)
      .single()

    if (!me || me.role !== 'dalali') {
      return NextResponse.json({ error: 'Si dalali' }, { status: 403 })
    }

    // Already has username — return it as-is
    if (me.username) {
      return NextResponse.json({
        username:   me.username,
        profileUrl: `${APP_URL}/agent/${me.username}`,
        generated:  false,
      })
    }

    const base = nameToSlug(me.full_name ?? '')

    // Load reserved usernames once
    const { data: reserved } = await admin.from('reserved_usernames').select('username')
    const reservedSet = new Set((reserved ?? []).map(r => r.username))

    // Try up to 10 candidates until one is available
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${base}_${randomSuffix()}`

      if (reservedSet.has(candidate)) continue

      const { data: taken } = await admin
        .from('users')
        .select('id')
        .eq('username', candidate)
        .maybeSingle()

      if (taken) continue

      // Claim it
      const { error } = await admin
        .from('users')
        .update({ username: candidate, username_changed_at: new Date().toISOString() })
        .eq('id', user.id)

      if (error) {
        if (error.code === '23505') continue   // race condition — retry
        return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
      }

      return NextResponse.json({
        username:   candidate,
        profileUrl: `${APP_URL}/agent/${candidate}`,
        generated:  true,
      })
    }

    return NextResponse.json({ error: 'Imeshindwa kupata username — jaribu tena' }, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
