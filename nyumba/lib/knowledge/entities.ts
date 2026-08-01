// Entity extraction for structured search.
// Uses Claude Haiku to pull searchable attributes from a user message.
// This is NOT a rule engine — Haiku handles all the linguistic variation
// (Kiswahili, mixed, abbreviations, "laki mbili", "sio ghali sana", etc.)

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type SearchType = 'listing' | 'vendor' | 'none'

// Listing type values that exist in the DB
export type ListingType = 'chumba' | 'apartment' | 'nyumba' | 'villa' | 'ofisi' | 'duka'

export interface ExtractedEntities {
  is_search:       boolean
  search_type:     SearchType
  // Listing attributes
  location?:       string        // region, district, ward, or mtaa — raw as user said it
  listing_type?:   ListingType
  bedrooms?:       number
  price_min?:      number        // Tsh/month
  price_max?:      number        // Tsh/month
  furnished?:      boolean
  // Vendor attributes
  vendor_category?: string       // e.g. 'electrician', 'plumber', 'painter'
  // Extraction confidence
  confidence:      number        // 0–1; low = entities too vague to search
}

export async function extractEntities(messageText: string): Promise<ExtractedEntities> {
  const prompt = `You extract search entities from WhatsApp messages for NyumbaFasta, a Tanzania property platform.

Message: "${messageText.slice(0, 500)}"

Decide:
1. is_search: Is this a property/vendor search request? (not a question, complaint, or greeting)
2. search_type: "listing" (house/room/office search), "vendor" (fundi/technician search), or "none"
3. Extract entities for listings: location, listing_type, bedrooms, price_min, price_max, furnished
4. Extract entities for vendors: vendor_category (e.g. "electrician", "plumber", "painter", "cleaner")

Listing types: chumba | apartment | nyumba | villa | ofisi | duka
Prices: convert "200k"→200000, "1M"→1000000, "laki mbili"→200000, "nusu M"→500000
"Sio ghali sana" or "bei nafuu" with no number → leave price_max null (too vague)
Location: extract the place name as-is (e.g. "Kinondoni", "Mbezi Beach", "Arusha")
confidence: 0.0–1.0 — how confident are you the extracted entities are usable for a DB query?
  Low confidence (<0.5): message is too vague (no location AND no price AND no type)

Respond with JSON only:
{"is_search":true,"search_type":"listing","location":"Kinondoni","listing_type":"chumba","bedrooms":2,"price_max":300000,"furnished":null,"vendor_category":null,"confidence":0.9}`

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text  = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}'
    const clean = text.replace(/```[a-z]*/g, '').replace(/```/g, '').trim()
    const raw   = JSON.parse(clean) as Record<string, unknown>

    return {
      is_search:        raw.is_search        === true,
      search_type:      (raw.search_type     as SearchType) ?? 'none',
      location:         raw.location         as string | undefined ?? undefined,
      listing_type:     raw.listing_type     as ListingType | undefined ?? undefined,
      bedrooms:         raw.bedrooms         != null ? parseInt(String(raw.bedrooms)) : undefined,
      price_min:        raw.price_min        != null ? parseInt(String(raw.price_min)) : undefined,
      price_max:        raw.price_max        != null ? parseInt(String(raw.price_max)) : undefined,
      furnished:        raw.furnished        != null ? raw.furnished === true : undefined,
      vendor_category:  raw.vendor_category  as string | undefined ?? undefined,
      confidence:       Math.min(1, Math.max(0, parseFloat(String(raw.confidence ?? 0.5)))),
    }
  } catch (err) {
    console.error('[Entities] extraction failed:', err)
    return { is_search: false, search_type: 'none', confidence: 0 }
  }
}
