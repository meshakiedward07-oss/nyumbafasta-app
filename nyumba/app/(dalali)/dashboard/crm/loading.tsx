export default function CRMLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      <div className="bg-primary-500 px-4 pt-10 pb-5">
        <div className="h-7 bg-primary-400 rounded w-40 mb-1" />
        <div className="h-4 bg-primary-400 rounded w-56" />
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-3 border border-gray-100">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-1" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="h-3 bg-gray-200 rounded w-1/3 mb-1" />
            <div className="h-3 bg-gray-200 rounded w-1/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
