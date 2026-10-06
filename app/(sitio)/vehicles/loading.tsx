export default function VehiclesLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="h-9 w-72 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-52 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="flex gap-8">
          {/* Filters sidebar skeleton */}
          <div className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm">
              <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Vehicle grid skeleton */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-white rounded-xl overflow-hidden shadow-sm">
                  <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
                    <div className="h-6 w-2/3 bg-gray-200 rounded animate-pulse" />
                    <div className="h-10 bg-gray-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
