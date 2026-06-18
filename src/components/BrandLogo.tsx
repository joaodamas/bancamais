type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="36" height="36" rx="10" fill="url(#brand-mark-grad)" />
          {/* sparkline ascendente */}
          <path
            d="M8 24.5 L15 18 L20 21 L28 11.5"
            stroke="#fff"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="28" cy="11.5" r="2.4" fill="#fff" />
          <defs>
            <linearGradient id="brand-mark-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      <div className="brand-wordmark-block">
        <div className="brand-wordmark-line">
          <strong className="brand-wordmark-text">Banca</strong>
          <svg className="brand-plus" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </div>
        {!compact && <span className="brand-tagline">Gestão de banca</span>}
      </div>
    </div>
  );
}
