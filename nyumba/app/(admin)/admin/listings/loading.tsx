export default function AdminListingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-24 bg-gray-200 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
            <div className="w-20 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="flex gap-2 mt-2">
                <div className="h-7 w-20 bg-gray-200 rounded-lg" />
                <div className="h-7 w-20 bg-gray-200 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
