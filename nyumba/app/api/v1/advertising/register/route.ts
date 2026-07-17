import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email, password,
      business_name, business_category,
      contact_phone, whatsapp_number,
      city, district, description, website_url,
    } = body

    if (!email || !password || !business_name || !business_category || !contact_phone || !city) {
      return NextResponse.json({ error: 'Tafadhali jaza sehemu zote zinazohitajika' }, { status: 400 })
    }

    const supabase = await createClient()
    const admin    = createAdminClient()

    // Check if already logged in and has advertiser profile
    const { data: { user: existingUser } } = await supabase.auth.getUser()

    let userId: string

    if (existingUser) {
      // Existing auth user — just create advertiser profile
      userId = existingUser.id
    } else {
      // Create new Supabase auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/advertising/dashboard` },
      })

      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 })
      }
      if (!signUpData.user) {
        return NextResponse.json({ error: 'Imeshindwa kuunda akaunti' }, { status: 500 })
      }
      userId = signUpData.user.id
    }

    // Check if advertiser profile already exists
    const { data: existing } = await admin
      .from('advertisers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Tayari una akaunti ya mfanyabiashara', existing: true }, { status: 409 })
    }

    // Create advertiser profile
    const { data: advertiser, error: insertError } = await admin
      .from('advertisers')
      .insert({
        user_id:           userId,
        business_name,
        business_category,
        contact_phone,
        whatsapp_number:   whatsapp_number ? normalizePhone(whatsapp_number) : null,
        email,
        city,
        district:          district || null,
        description:       description || null,
        website_url:       website_url || null,
        status:            'pending_review',
      })
      .select('id, status')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Notify admin (non-blocking)
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      import('@/lib/email/templates').then(({ emailBase }) => {
        import('resend').then(({ Resend }) => {
          new Resend(process.env.RESEND_API_KEY).emails.send({
            from: 'NyumbaFasta <noreply@nyumbafasta.co>',
            to: adminEmail,
            subject: `🏪 Mfanyabiashara Mpya — ${business_name}`,
            html: emailBase(`<p>Mfanyabiashara mpya amesajili: <b>${business_name}</b> (${city})<br>Angalia Admin Panel: <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/adverts">Admin → Matangazo</a></p>`, 'Mfanyabiashara mpya amesajili'),
          })
        })
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, advertiser_id: advertiser.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
