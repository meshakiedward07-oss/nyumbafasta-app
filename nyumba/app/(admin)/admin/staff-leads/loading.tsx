export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}
