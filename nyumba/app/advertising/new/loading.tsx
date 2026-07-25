export default function Loading() {
  return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-gray-200 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
    </div>
  )
}
