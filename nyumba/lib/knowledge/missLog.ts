import { supabaseAdmin } from '@/lib/agent/supabaseAdmin'

export type CascadeLayer = 'cache' | 'knowledge_base' | 'search' | 'amina' | 'handover'

export interface MissContext {
  phoneNumber?:     string
  sessionId?:       string
  flowType?:        string
  bestCacheSim?:    number
  bestKbSim?:       number
  searchHadResults?: boolean
  invokedAmina?:    boolean
  aminaResponse?:   string
  handoverTriggered?: boolean
}

export async function logMiss(
  messageText: string,
  layerReached: CascadeLayer,
  ctx: MissContext = {},
): Promise<void> {
  try {
    await supabaseAdmin.from('cascade_miss_log').insert({
      phone_number:          ctx.phoneNumber        ?? null,
      session_id:            ctx.sessionId          ?? null,
      flow_type:             ctx.flowType           ?? null,
      message_text:          messageText,
      layer_reached:         layerReached,
      best_cache_similarity: ctx.bestCacheSim       ?? null,
      best_kb_similarity:    ctx.bestKbSim          ?? null,
      search_returned_results: ctx.searchHadResults ?? null,
      invoked_amina:         ctx.invokedAmina       ?? false,
      amina_response:        ctx.aminaResponse      ?? null,
      handover_triggered:    ctx.handoverTriggered  ?? false,
    })
  } catch (err) {
    // Non-fatal: miss logging should never block the main response
    console.error('[MissLog] insert failed (non-fatal):', err)
  }
}
