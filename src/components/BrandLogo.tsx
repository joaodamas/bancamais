type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <div className="brand-wordmark-block">
        <div className="brand-wordmark-line">
          <strong className="brand-wordmark-text">Banca</strong>
          <svg
            className="brand-wordmark-plus"
            viewBox="0 0 12 12"
            aria-hidden="true"
          >
            <path d="M6 1.75v8.5M1.75 6h8.5" />
          </svg>
        </div>
        {!compact && <span className="brand-tagline">Gestão institucional de banca</span>}
      </div>
    </div>
  );
}
