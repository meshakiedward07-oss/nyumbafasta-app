import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateProfile } from '@/lib/security/validate'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Taarifa si sahihi' }, { status: 400 })

    const parsed = validateProfile(body)
    if (!parsed.ok) {
      return NextResponse.json({ error: 'Taarifa si sahihi', details: parsed.errors }, { status: 400 })
    }
    const { full_name, whatsapp_number, bio, avatar_url } = parsed.data

    const admin = createAdminClient()

    // Update users table (name + optional avatar) — explicit allowlist
    const userUpdate: Record<string, string> = {}
    if (full_name) userUpdate.full_name = full_name
    if (avatar_url !== undefined) userUpdate.avatar_url = avatar_url
    if (Object.keys(userUpdate).length) {
      await admin.from('users').update(userUpdate).eq('id', user.id)
    }

    // Upsert dalali_profiles
    const { error } = await admin
      .from('dalali_profiles')
      .upsert({
        user_id: user.id,
        whatsapp_number: whatsapp_number ?? '',
        bio: bio ?? null,
      }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
