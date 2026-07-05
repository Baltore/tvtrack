// Placeholders animés affichés pendant les chargements.

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-poster" />
      <div className="skeleton skeleton-line" style={{ width: '85%' }} />
      <div className="skeleton skeleton-line" style={{ width: '55%' }} />
    </div>
  );
}

export function SkeletonGrid({ count = 10 }) {
  return (
    <div className="media-grid">
      {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
    </div>
  );
}

export function SkeletonStats({ count = 8 }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-stat" />
      ))}
    </div>
  );
}

export function SkeletonRow({ count = 6 }) {
  return (
    <div className="media-row">
      {Array.from({ length: count }, (_, index) => <SkeletonCard key={index} />)}
    </div>
  );
}
