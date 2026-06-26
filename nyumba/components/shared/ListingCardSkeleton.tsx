export default function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      {/* Image placeholder */}
      <div className="h-44 skeleton" />

      <div className="p-3">
        {/* Title + price row */}
        <div className="flex justify-between items-start gap-2 mb-2">
          <div className="skeleton h-4 rounded-full flex-1" />
          <div className="skeleton h-4 w-16 rounded-full" />
        </div>

        {/* Location */}
        <div className="skeleton h-3 w-32 rounded-full mb-3" />

        {/* Badges */}
        <div className="flex gap-1.5 mb-3">
          <div className="skeleton h-5 w-20 rounded-full" />
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>

        {/* Dalali row */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2">
            <div className="skeleton w-6 h-6 rounded-full" />
            <div className="skeleton h-3 w-20 rounded-full" />
          </div>
          <div className="skeleton h-3 w-10 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function ListingGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  )
}
