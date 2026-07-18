// Superadmin account that must never be modified, suspended, or deleted
// via any API endpoint. Only the recover-account emergency endpoint
// may touch this account (it requires SUPABASE_SERVICE_ROLE_KEY).
// To change this, update the code directly as instructed by the account holder.
export const SUPERADMIN_EMAIL = 'meshakiedward07@gmail.com'

export function isSuperadmin(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase()
}
