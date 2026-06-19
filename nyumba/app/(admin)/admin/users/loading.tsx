export default function AdminUsersLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-40 mb-4" />
      <div className="h-10 bg-gray-200 rounded-xl mb-4" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
            </div>
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
