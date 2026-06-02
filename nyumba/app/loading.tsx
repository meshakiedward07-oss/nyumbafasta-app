import { ListingGridSkeleton } from '@/components/shared/ListingCardSkeleton'
import BottomNav from '@/components/shared/BottomNav'

export default function HomeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header skeleton */}
      <div className="bg-primary-500 px-4 pt-10 pb-5">
        <div className="flex justify-between items-center mb-3">
          <div>
            <div className="h-6 w-24 skeleton rounded-full mb-1" />
            <div className="h-3 w-36 skeleton rounded-full" />
          </div>
          <div className="w-9 h-9 rounded-full skeleton" />
        </div>
        <div className="h-10 skeleton rounded-xl" />
      </div>

      {/* Region tabs skeleton */}
      <div className="flex gap-2 px-4 py-3">
        {[60, 48, 52, 44, 56].map((w, i) => (
          <div key={i} className={`h-7 w-${w} skeleton rounded-full flex-shrink-0`} style={{ width: w * 1.5 }} />
        ))}
      </div>

      {/* Count skeleton */}
      <div className="px-4 mb-3">
        <div className="h-4 w-40 skeleton rounded-full" />
      </div>

      <ListingGridSkeleton count={4} />
      <BottomNav />
    </div>
  )
}
