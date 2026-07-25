export default function Loading() {
  return (
    <div className="p-6 space-y-4 max-w-md mx-auto">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}
