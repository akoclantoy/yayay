export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"
      role="status"
      aria-label="Loading page"
    >
      <span className="sr-only">Loading page…</span>
      <div className="skeleton-shimmer h-9 w-56 rounded-lg" />
      <div className="skeleton-shimmer h-5 w-80 max-w-full rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="space-y-4 rounded-2xl border bg-card p-5"
            aria-hidden="true"
          >
            <div className="skeleton-shimmer h-12 w-12 rounded-xl" />
            <div className="skeleton-shimmer h-5 w-2/3 rounded-md" />
            <div className="skeleton-shimmer h-4 w-full rounded-md" />
            <div className="skeleton-shimmer h-4 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
    </main>
  );
}
