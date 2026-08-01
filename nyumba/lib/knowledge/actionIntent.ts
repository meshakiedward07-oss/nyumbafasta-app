// Action intent extraction for Phase 3 of the cascade.
// Detects when the user wants to take a real action (not just search for information).
// Uses Claude Haiku — cheap, fast, handles Kiswahili naturally.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ActionType = 'maintenance' | 'viewing' | 'subscription' | null

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'structural'
  | 'cleaning'
  | 'security'
  | 'appliance'
  | 'other'

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ActionIntent {
  is_action:   boolean
  action_type: ActionType
  confidence:  number   // 0–1

  // Maintenance fields (when action_type === 'maintenance')
  maintenance_description?:      string
  maintenance_category?:         MaintenanceCategory
  maintenance_priority?:         MaintenancePriority
  maintenance_has_enough_detail: boolean   // enough to create a request without asking Amina

  // Viewing fields (when action_type === 'viewing')
  viewing_listing_hint?: string   // e.g. "ile ya Kinondoni", "apartment ya 2BR"
}

export async function extractActionIntent(messageText: string): Promise<ActionIntent> {
  const prompt = `You detect action intent from WhatsApp messages for NyumbaFasta (Tanzania property platform).

Message: "${messageText.slice(0, 500)}"

Detect if the user wants to take a REAL ACTION — not just search or ask a question.

Actions:
- "maintenance": report a property repair/maintenance issue (maji, umeme, mlango, kuziba, uvujaji, etc.)
- "viewing": wants to visit/view a specific property (nataka kuona, nionyeshe, naweza kuja, tembelea)
- "subscription": wants to pay for dalali subscription (lipa subscription, subscribe, niwe premium)
- null: none of the above (it's a search, question, or greeting)

For maintenance:
- Extract description (what's broken/wrong, as said by user)
- Guess category: plumbing | electrical | structural | cleaning | security | appliance | other
- Guess priority: low (cosmetic) | medium (inconvenient) | high (can't function) | urgent (safety/flooding)
- maintenance_has_enough_detail: true if we have a usable description (at least what/where the problem is)

For viewing:
- Extract listing_hint: any description of the property they want to view (optional)

confidence: how confident the action intent is (0.0–1.0)
- High (0.8+): explicit action words ("niomba matengenezo", "nataka kuona", "lipa subscription")
- Medium (0.5–0.8): implied ("maji yamenipotea", "nataka kuja kesho")
- Low (<0.5): ambiguous or just a question

Respond with JSON only — no explanation:
{"is_action":true,"action_type":"maintenance","confidence":0.9,"maintenance_description":"maji yanayovuja bafuni","maintenance_category":"plumbing","maintenance_priority":"high","maintenance_has_enough_detail":true,"viewing_listing_hint":null}`

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 180,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = text.replace(/```[a-z]*/g, '').replace(/```/g, '').trim()
    const raw   = JSON.parse(clean) as Record<string, unknown>

    return {
      is_action:   raw.is_action === true,
      action_type: (raw.action_type as ActionType) ?? null,
      confidence:  Math.min(1, Math.max(0, parseFloat(String(raw.confidence ?? 0)))),

      maintenance_description:      raw.maintenance_description as string | undefined ?? undefined,
      maintenance_category:         raw.maintenance_category    as MaintenanceCategory | undefined ?? undefined,
      maintenance_priority:         raw.maintenance_priority    as MaintenancePriority | undefined ?? undefined,
      maintenance_has_enough_detail: raw.maintenance_has_enough_detail === true,

      viewing_listing_hint: raw.viewing_listing_hint as string | undefined ?? undefined,
    }
  } catch (err) {
    console.error('[ActionIntent] extraction failed:', err)
    return {
      is_action:   false,
      action_type: null,
      confidence:  0,
      maintenance_has_enough_detail: false,
    }
  }
}
