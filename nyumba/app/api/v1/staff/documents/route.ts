import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export const dynamic = 'force-dynamic'

const CLOUD      = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const API_KEY    = process.env.CLOUDINARY_API_KEY!
const API_SECRET = process.env.CLOUDINARY_API_SECRET!
const MAX_SIZE   = 10 * 1024 * 1024
const ALLOWED    = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

function sign(params: Record<string, string | number>): string {
  const str = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
  return createHash('sha256').update(str + API_SECRET).digest('hex')
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin.from('staff_documents').select('*').eq('staff_id', user.id).order('uploaded_at', { ascending: false })
  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'staff'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Imeshindwa kusoma faili' }, { status: 400 }) }

  const file    = form.get('file') as File | null
  const docType = (form.get('document_type') as string | null)?.trim() ?? ''
  const docName = (form.get('document_name') as string | null)?.trim() ?? ''

  if (!file || !docType)       return NextResponse.json({ error: 'Faili na aina ya hati vinahitajika' }, { status: 400 })
  if (file.size > MAX_SIZE)    return NextResponse.json({ error: 'Faili ni kubwa sana (kiwango cha juu: 10MB)' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Tumia PDF, JPG, au PNG pekee' }, { status: 400 })

  const isPdf     = file.type === 'application/pdf'
  const resType   = isPdf ? 'raw' : 'image'
  const folder    = `nyumbafasta/staff-docs/${user.id}`
  const timestamp = Math.round(Date.now() / 1000)
  const signature = sign({ folder, resource_type: resType, timestamp })

  const fd = new FormData()
  fd.append('file', new Blob([await file.arrayBuffer()], { type: file.type }), file.name)
  fd.append('api_key', API_KEY)
  fd.append('timestamp', String(timestamp))
  fd.append('signature', signature)
  fd.append('folder', folder)
  fd.append('resource_type', resType)

  const cloudRes  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resType}/upload`, { method: 'POST', body: fd })
  const cloudData = await cloudRes.json()
  if (!cloudData.secure_url) {
    return NextResponse.json({ error: cloudData.error?.message ?? 'Imeshindwa kupakia faili' }, { status: 500 })
  }

  const { data, error } = await admin.from('staff_documents').insert({
    staff_id:      user.id,
    document_type: docType,
    document_name: docName || file.name,
    document_url:  cloudData.secure_url,
    file_type:     isPdf ? 'pdf' : file.type.split('/')[1],
    file_size_kb:  Math.round(file.size / 1024),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, document: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const docId = new URL(req.url).searchParams.get('id')
  if (!docId) return NextResponse.json({ error: 'id inahitajika' }, { status: 400 })

  const admin = createAdminClient()
  const { data: doc } = await admin.from('staff_documents').select('is_verified').eq('id', docId).eq('staff_id', user.id).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Hati haipatikani' }, { status: 404 })
  if (doc.is_verified) return NextResponse.json({ error: 'Hati iliyothihibitiwa haiwezi kufutwa' }, { status: 400 })

  const { error } = await admin.from('staff_documents').delete().eq('id', docId).eq('staff_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
