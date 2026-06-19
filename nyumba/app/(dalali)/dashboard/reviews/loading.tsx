export default function ReviewsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      <div className="bg-primary-500 px-4 pt-10 pb-5">
        <div className="h-7 bg-primary-400 rounded w-40" />
      </div>
      <div className="p-4 space-y-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gray-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-gray-200 rounded w-16" />
            <div className="h-3 bg-gray-200 rounded w-32" />
          </div>
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-16" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
