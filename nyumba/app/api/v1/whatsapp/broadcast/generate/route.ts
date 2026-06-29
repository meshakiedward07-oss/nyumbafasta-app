import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { requireAdminUser } from '@/lib/security/adminAuth'

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `Wewe ni Amina, msaidizi wa AI wa NyumbaFasta — platform ya kupanga nyumba Tanzania. Kazi yako ni kuandika ujumbe wa WhatsApp wa broadcast kwa madalali (mawakala wa nyumba).

KANUNI:
- Andika kwa Kiswahili cha kawaida cha Tanzania (Dar es Salaam style)
- Ujumbe uwe mfupi na wazi — chini ya maneno 100, siyo zaidi
- USIJUMUISHE salamu ya mwanzo (k.m. "Habari!" au "Kwa heshima,") — mfumo unaongeza salamu kiotomatiki
- Unaweza kutumia {jina} mahali unapotaka kuandika jina la mtu binafsi
- Mwisho wa ujumbe lazima kuwe na wito wa hatua (call-to-action) wazi
- Tumia emoji moja au mbili tu — siyo nyingi sana
- Andika ujumbe tu — usijumuishe maelezo, maneno ya utangulizi, au alama za nukuu nje ya ujumbe wenyewe`

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { instruction, target, tone, previousDraft } = await req.json() as {
    instruction: string
    target: string
    tone: string
    previousDraft?: string
  }

  if (!instruction?.trim()) {
    return NextResponse.json({ error: 'Maelekezo yanahitajika' }, { status: 400 })
  }

  const targetLabel =
    target === 'active_dalali' ? 'madalali wenye subscription inayoendelea' :
    target === 'new_dalali'    ? 'madalali wapya waliojisajili wiki hii' :
    'madalali wote waliojisajili'

  const toneLabel =
    tone === 'formal' ? 'rasmi na ya heshima' :
    tone === 'urgent' ? 'ya haraka na ya muhimu' :
    'ya kirafiki na ya karibu'

  const userMessage = previousDraft
    ? `Maelekezo ya admin: ${instruction.trim()}\n\nRasimu ya kwanza uliyoandika:\n${previousDraft}\n\nTafadhali andika toleo jipya/bora zaidi kwa kuzingatia maoni haya.`
    : `Maelekezo ya admin: ${instruction.trim()}\n\nWapokeaji: ${targetLabel}\nSauti ya ujumbe: ${toneLabel}`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const draft = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return NextResponse.json({ draft })
  } catch (err) {
    console.error('[Broadcast/Generate] Anthropic error:', err)
    return NextResponse.json({ error: 'Amina hakuweza kuandika ujumbe. Jaribu tena.' }, { status: 500 })
  }
}
