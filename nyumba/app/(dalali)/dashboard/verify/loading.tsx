export default function Loading() {
  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-24 bg-gray-200 rounded-xl animate-pulse" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  )
}
