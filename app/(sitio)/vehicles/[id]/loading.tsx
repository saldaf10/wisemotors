export default function VehicleDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero skeleton */}
      <div className="relative h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-screen bg-gray-800 animate-pulse">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
          <div className="h-8 w-32 bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="h-16 w-96 max-w-full bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="h-10 w-48 bg-gray-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Specs skeleton */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="h-6 w-48 bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="h-8 w-full bg-gray-200 rounded mb-4 animate-pulse" />
              <div className="h-12 w-full bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
