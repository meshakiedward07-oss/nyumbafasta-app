import { NextRequest, NextResponse } from 'next/server'
import { requireStaffAuth } from '@/lib/security/adminAuth'
import { createAdminClient } from '@/lib/supabase/server'

export type ContactResult = {
  id:    string
  name:  string
  email: string
  type:  'client' | 'dalali' | 'advertiser'
  meta?: string
}

export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const q    = (searchParams.get('q') ?? '').trim()
  const type = searchParams.get('type') ?? 'all' // 'all' | 'client' | 'dalali' | 'advertiser'

  if (!q || q.length < 2) {
    return NextResponse.json({ contacts: [] })
  }

  const admin = createAdminClient()
  const contacts: ContactResult[] = []

  // ── Advertisers (have email directly in table) ────────────────────────────
  if (type === 'all' || type === 'advertiser') {
    const { data: advs } = await admin
      .from('advertisers')
      .select('id, business_name, email, city')
      .or(`business_name.ilike.%${q}%,email.ilike.%${q}%`)
      .eq('status', 'active')
      .limit(10)

    for (const a of advs ?? []) {
      if (!a.email) continue
      contacts.push({
        id:    a.id as string,
        name:  a.business_name as string,
        email: a.email as string,
        type:  'advertiser',
        meta:  a.city as string | undefined,
      })
    }
  }

  // ── Users (clients + dalalis) — email lives in auth.users ────────────────
  if (type === 'all' || type === 'client' || type === 'dalali') {
    const roleFilter = type === 'client' ? ['client']
                     : type === 'dalali' ? ['dalali']
                     : ['client', 'dalali']

    const { data: users } = await admin
      .from('users')
      .select('id, full_name, phone, role')
      .in('role', roleFilter)
      .ilike('full_name', `%${q}%`)
      .limit(15)

    if (users && users.length > 0) {
      // Fetch auth emails in bulk
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = new Map(authUsers?.map(u => [u.id, u.email ?? '']) ?? [])

      // Also try email search on auth if the query looks like an email
      const isEmailQuery = q.includes('@')
      if (isEmailQuery) {
        const matched = authUsers?.filter(u => u.email?.toLowerCase().includes(q.toLowerCase())) ?? []
        const matchedIds = new Set(matched.map(u => u.id))

        // Fetch user rows for email-matched auth users
        if (matchedIds.size > 0) {
          const { data: emailMatchedUsers } = await admin
            .from('users')
            .select('id, full_name, role')
            .in('id', [...matchedIds])
            .in('role', roleFilter)
            .limit(10)

          for (const u of emailMatchedUsers ?? []) {
            const email = emailMap.get(u.id as string) ?? ''
            if (!email) continue
            if (contacts.some(c => c.email === email)) continue
            contacts.push({
              id:    u.id as string,
              name:  u.full_name as string,
              email,
              type:  u.role as 'client' | 'dalali',
            })
          }
        }
      }

      for (const u of users) {
        const email = emailMap.get(u.id as string) ?? ''
        if (!email) continue
        if (contacts.some(c => c.email === email)) continue
        contacts.push({
          id:    u.id as string,
          name:  u.full_name as string,
          email,
          type:  u.role as 'client' | 'dalali',
          meta:  u.phone as string | undefined,
        })
      }
    }
  }

  return NextResponse.json({ contacts: contacts.slice(0, 15) })
}
