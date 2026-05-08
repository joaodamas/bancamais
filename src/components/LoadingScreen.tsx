export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-shell" aria-hidden="true">
        <div className="loading-shell-head">
          <div className="skeleton-line" style={{ height: 18, width: 180 }} />
          <div className="skeleton-line" style={{ height: 12, width: 120 }} />
        </div>
        <div className="loading-card-grid">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="loading-card">
              <div className="skeleton-line" style={{ height: 10, width: "42%" }} />
              <div className="skeleton-line" style={{ height: 32, width: "68%" }} />
              <div className="skeleton-line" style={{ height: 12, width: "84%" }} />
            </div>
          ))}
        </div>
        <div className="loading-table">
          <div className="skeleton-line" style={{ height: 14, width: "32%" }} />
          <div className="skeleton-line" style={{ height: 14, width: "100%" }} />
          <div className="skeleton-line" style={{ height: 14, width: "96%" }} />
          <div className="skeleton-line" style={{ height: 14, width: "88%" }} />
        </div>
      </div>
    </div>
  );
}
