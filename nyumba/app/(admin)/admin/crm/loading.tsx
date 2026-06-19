export default function AdminCRMLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40 mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-6 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-5 w-14 bg-gray-200 rounded-full" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-1/4 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
