import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// In-process cache: saves API calls for identical strings within the same request
const cache = new Map<string, number[]>()

export const EMBEDDING_DIMENSIONS = 1536
export const EMBEDDING_MODEL = 'text-embedding-3-small'

export async function embed(text: string): Promise<number[]> {
  const key = text.slice(0, 512)
  const hit = cache.get(key)
  if (hit) return hit

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8191), // model max
    dimensions: EMBEDDING_DIMENSIONS,
  })

  const vector = response.data[0].embedding
  if (cache.size > 500) cache.clear() // prevent unbounded growth
  cache.set(key, vector)
  return vector
}

// Normalise Kiswahili / English synonyms before embedding so the vector
// space is tighter for multilingual queries. This is not a rule engine —
// it just canonicalises obvious phonetic/abbreviation variants so the
// embedding model sees consistent tokens.
export function normaliseQuery(text: string): string {
  return text
    .toLowerCase()
    .replace(/\broom\b/g, 'chumba')
    .replace(/\bhouse\b/g, 'nyumba')
    .replace(/\bapartment\b/g, 'nyumba')
    .replace(/\bflat\b/g, 'nyumba')
    .replace(/\bbedsit\b/g, 'chumba kimoja')
    .replace(/\bbedroom(s?)\b/g, 'chumba$1')
    .replace(/\brent\b/g, 'kodi')
    .replace(/\bagent\b/g, 'dalali')
    .replace(/\bbroker\b/g, 'dalali')
    .replace(/\bprice\b/g, 'bei')
    .replace(/\bpay\b/g, 'lipa')
    .replace(/\bpayment\b/g, 'malipo')
    .replace(/\bcontact\b/g, 'mawasiliano')
    .replace(/\bsubscription\b/g, 'usajili')
    .replace(/\bunlock\b/g, 'fungua')
    .trim()
}
