import { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any>

const BUCKET      = 'listings'
const ROOT_PREFIX = 'ad-uploads'
const MAX_DEPTH    = 4    // known structure is 2 levels deep (advertiserId/campaignId); a small margin, not unbounded
const MAX_DELETIONS = 500 // hard cap per cron run — safety valve on a real delete operation

/**
 * Sweeps orphaned temp uploads under `ad-uploads/` in the shared `listings`
 * Storage bucket. This prefix is created by
 * GET /api/v1/advertising/campaigns/[id]/creative/sign (a presigned upload
 * URL) and is ALWAYS meant to be ephemeral — every code path that
 * successfully or unsuccessfully processes an upload deletes its own
 * `paths` afterward (see .../creative/route.ts). So by design, anything
 * still sitting under `ad-uploads/` older than `cutoffIso` was abandoned —
 * most commonly a browser tab closed or connection dropped between the
 * presigned PUT and the follow-up POST that would have processed and
 * removed it. Found in the 2026-09-01 ads-creative audit.
 *
 * Deliberately does NOT touch `ad-creatives/` (the permanent, processed
 * asset location) — only the `ad-uploads/` scratch prefix is ever a
 * deletion candidate here.
 *
 * Recurses the known 2-level structure (advertiserId/campaignId/file) with
 * a small safety margin (MAX_DEPTH) rather than assuming it forever, and
 * caps total deletions per run (MAX_DELETIONS) so a real delete operation
 * against production Storage always has a hard ceiling on possible damage
 * from an unexpected structure or a bug.
 */
export async function sweepOrphanedAdUploads(
  admin: AnyClient,
  cutoffIso: string,
): Promise<{ deleted: string[]; errors: string[] }> {
  const deleted: string[] = []
  const errors: string[] = []

  async function walk(prefix: string, depth: number): Promise<void> {
    if (deleted.length >= MAX_DELETIONS || depth > MAX_DEPTH) return

    const { data: entries, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 })
    if (error) {
      errors.push(`list(${prefix}): ${error.message}`)
      return
    }
    if (!entries?.length) return

    const filesToDelete: string[] = []

    for (const entry of entries) {
      if (deleted.length + filesToDelete.length >= MAX_DELETIONS) break
      const fullPath = `${prefix}/${entry.name}`

      // Supabase Storage list() marks "folder" placeholders with id === null
      // — a real file always has an id. Recurse into folders, age-check files.
      if (entry.id === null) {
        await walk(fullPath, depth + 1)
        continue
      }

      const createdAt = entry.created_at as string | undefined
      if (createdAt && createdAt < cutoffIso) {
        filesToDelete.push(fullPath)
      }
    }

    if (filesToDelete.length > 0) {
      const { error: removeErr } = await admin.storage.from(BUCKET).remove(filesToDelete)
      if (removeErr) {
        errors.push(`remove(${prefix}, ${filesToDelete.length} files): ${removeErr.message}`)
      } else {
        deleted.push(...filesToDelete)
      }
    }
  }

  await walk(ROOT_PREFIX, 0)
  return { deleted, errors }
}
