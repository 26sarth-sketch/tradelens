// Shown instantly while a screen's data loads, so navigation never looks frozen.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skel mb-2 h-9 w-56" />
      <div className="skel mb-6 h-4 w-80 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skel h-24" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skel h-72 lg:col-span-2" />
        <div className="skel h-72" />
      </div>
    </div>
  );
}
