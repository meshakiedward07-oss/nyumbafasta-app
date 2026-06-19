export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 animate-pulse">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-gray-100 space-y-4">
        <div className="h-10 w-10 bg-gray-200 rounded-xl mx-auto mb-2" />
        <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4" />
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-12 bg-gray-200 rounded-xl" />
        <div className="h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}
