export default function ListingDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 pb-28 animate-pulse">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-gray-200" />
        <div className="flex-1 h-4 bg-gray-200 rounded-full" />
        <div className="w-20 h-6 bg-gray-200 rounded-full" />
      </div>

      {/* Image placeholder */}
      <div className="h-64 bg-gray-200" />

      {/* Thumbnails */}
      <div className="flex gap-2 px-4 py-2 bg-white border-b border-gray-100">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-14 h-14 rounded-lg bg-gray-200 flex-shrink-0" />
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">

        {/* Price + title card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <div className="h-5 bg-gray-200 rounded-full w-3/4" />
          <div className="h-7 bg-gray-200 rounded-full w-1/2" />
          <div className="flex gap-2">
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
            <div className="h-6 w-20 bg-gray-200 rounded-full" />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
          <div className="h-4 bg-gray-200 rounded-full w-1/3" />
          <div className="h-3 bg-gray-200 rounded-full w-1/2" />
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
          <div className="h-4 bg-gray-200 rounded-full w-1/4" />
          <div className="h-3 bg-gray-200 rounded-full w-full" />
          <div className="h-3 bg-gray-200 rounded-full w-5/6" />
          <div className="h-3 bg-gray-200 rounded-full w-4/6" />
        </div>

        {/* Dalali card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded-full w-2/3" />
              <div className="h-3 bg-gray-200 rounded-full w-1/3" />
            </div>
          </div>
        </div>

      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
        <div className="h-12 bg-gray-200 rounded-2xl" />
      </div>
    </div>
  )
}
