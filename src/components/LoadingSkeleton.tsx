interface SkeletonProps {
  lines?: number;
  height?: number;
}

export function LoadingSkeleton({ lines = 3, height = 18 }: SkeletonProps) {
  return (
    <div className="skeleton-wrapper">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-line"
          style={{
            height,
            width: i === lines - 1 ? "60%" : "100%",
          }}
        />
      ))}
    </div>
  );
}
