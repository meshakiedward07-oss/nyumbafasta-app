export default function NotificationsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      <div className="bg-primary-500 px-4 pt-10 pb-5">
        <div className="h-7 bg-primary-400 rounded w-40" />
      </div>
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
