export default function SubscriptionLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 animate-pulse">
      <div className="px-4 pt-4 space-y-4">
        {/* Current plan card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
        {/* Plan options */}
        {[1,2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-1/4" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="space-y-2">
              {[1,2,3].map(j => <div key={j} className="h-3 bg-gray-200 rounded w-3/4" />)}
            </div>
            <div className="h-10 bg-gray-200 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}
