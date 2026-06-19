export default function SavedLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      <div className="bg-primary-500 px-4 pt-10 pb-5">
        <div className="h-7 bg-primary-400 rounded w-48" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-3 flex gap-3">
            <div className="w-24 h-20 bg-gray-200 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
              <div className="h-5 bg-gray-200 rounded w-20 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
