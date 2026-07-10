export interface PaginationParams {
  page:   number
  limit:  number
  offset: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page:        number
    limit:       number
    total:       number
    totalPages:  number
    hasNext:     boolean
    hasPrev:     boolean
  }
}

/**
 * Parse ?page= and ?limit= from a URL's search params.
 * Page is 1-based; offset is 0-based.
 */
export function getPagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit     = 100,
): PaginationParams {
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit), 10)),
  )
  return { page, limit, offset: (page - 1) * limit }
}

/** Wrap a data array in the standard paginated envelope */
export function paginate<T>(
  data:  T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResponse<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return {
    data,
    pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
  }
}

/** Returns [from, to] for a Supabase .range() call */
export function supabaseRange({ offset, limit }: PaginationParams): [number, number] {
  return [offset, offset + limit - 1]
}
