export default function LoginLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header skeleton — matches green header with logo */}
      <div className="bg-primary-500 px-4 pt-10 pb-8 flex justify-center items-center">
        <div className="h-20 w-40 bg-white/20 rounded-xl animate-pulse" />
      </div>

      <div className="flex-1 px-4 -mt-4 pb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
          <div className="p-5 space-y-4">
            {/* Email field */}
            <div>
              <div className="h-3 w-24 bg-gray-200 rounded-full mb-2" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
            {/* Password field */}
            <div>
              <div className="h-3 w-20 bg-gray-200 rounded-full mb-2" />
              <div className="h-12 bg-gray-100 rounded-xl" />
            </div>
            {/* Forgot link */}
            <div className="flex justify-end">
              <div className="h-3 w-32 bg-gray-200 rounded-full" />
            </div>
            {/* Submit button */}
            <div className="h-12 bg-primary-100 rounded-xl" />
            {/* Divider */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-gray-100" />
              <div className="h-3 w-20 bg-gray-200 rounded-full" />
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {/* Google button */}
            <div className="h-12 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
