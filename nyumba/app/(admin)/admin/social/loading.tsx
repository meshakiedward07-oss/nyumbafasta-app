export default function Loading() {
  return (
    <div className="flex min-h-full" style={{ background: '#f4f4f0' }}>
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex flex-col w-[185px] flex-shrink-0 bg-white border-r" style={{ borderColor: '#e5e5e0' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: '#e5e5e0' }}>
          <div className="h-8 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="flex-1 px-2 py-3 space-y-4">
          {[4, 4, 3, 2, 4].map((count, gi) => (
            <div key={gi}>
              <div className="h-2 w-16 bg-gray-100 rounded animate-pulse mx-2.5 mb-2" />
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse mb-0.5" />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main skeleton */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <div className="bg-white border-b px-6 py-4" style={{ borderColor: '#e5e5e0' }}>
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="h-3 w-56 bg-gray-100 rounded animate-pulse mt-1.5" />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" style={{ border: '1px solid #e5e5e0' }} />
            ))}
          </div>
          <div className="h-40 bg-white rounded-xl animate-pulse" style={{ border: '1px solid #e5e5e0' }} />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse" style={{ border: '1px solid #e5e5e0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
