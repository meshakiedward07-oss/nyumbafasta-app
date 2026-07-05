export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-primary-500 px-4 pt-10 pb-6">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="h-3 bg-white/30 rounded w-16 mb-1.5" />
            <div className="h-6 bg-white/40 rounded w-36 mb-2" />
            <div className="h-3 bg-white/25 rounded w-24" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white/20 rounded-xl" />
            <div className="w-16 h-9 bg-white/20 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white/10 rounded-2xl p-3 border border-white/15">
              <div className="h-3 bg-white/25 rounded w-3 mb-1.5" />
              <div className="h-6 bg-white/35 rounded w-8 mb-1" />
              <div className="h-2.5 bg-white/20 rounded w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Content skeleton */}
      <div className="px-4 pt-4 space-y-4">
        {/* Subscription banner */}
        <div className="h-24 bg-white rounded-2xl border border-gray-100" />

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100" />
          ))}
        </div>

        {/* Listings */}
        <div className="space-y-3">
          <div className="h-5 bg-gray-200 rounded w-32" />
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-3">
              <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
