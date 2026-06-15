export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 p-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Listings section */}
      <div className="px-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-1/3 mb-1" />
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
  )
}
