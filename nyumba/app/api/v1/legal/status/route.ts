import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Hujaidhibitishwa' }, { status: 401 })
    }

    const { data } = await supabase
      .from('users')
      .select('agreement_accepted, agreement_version, agreement_accepted_at, account_status, role')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      agreement_accepted:    data?.agreement_accepted ?? false,
      agreement_version:     data?.agreement_version ?? null,
      agreement_accepted_at: data?.agreement_accepted_at ?? null,
      account_status:        data?.account_status ?? 'active',
      role:                  data?.role ?? 'client',
    })
  } catch {
    return NextResponse.json({ error: 'Hitilafu ya seva' }, { status: 500 })
  }
}
