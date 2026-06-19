export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-pulse">
      <div className="bg-primary-500 px-4 pt-10 pb-16">
        <div className="h-6 bg-primary-400 rounded w-32" />
      </div>
      <div className="-mt-10 mx-4 bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-center mb-4">
        <div className="w-16 h-16 bg-gray-200 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-40" />
          <div className="h-3 bg-gray-200 rounded w-56" />
        </div>
      </div>
      <div className="mx-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 h-4 bg-gray-200 rounded w-2/3" />
            <div className="w-4 h-4 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
