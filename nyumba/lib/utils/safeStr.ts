/** Convert any value to a string safe for rendering as a React child. */
export function safeStr(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Error) return value.message
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.message === 'string') return v.message
    if (typeof v.error === 'string') return v.error
    if (typeof v.text === 'string') return v.text
    return JSON.stringify(value)
  }
  return String(value)
}
