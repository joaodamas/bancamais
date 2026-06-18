type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="9" fill="url(#brand-mark-grad)" />
          <rect x="7.5" y="17.5" width="3.6" height="7" rx="1.8" fill="#fff" fillOpacity="0.75" />
          <rect x="14.2" y="13" width="3.6" height="11.5" rx="1.8" fill="#fff" fillOpacity="0.88" />
          <rect x="20.9" y="8.5" width="3.6" height="16" rx="1.8" fill="#fff" />
          <defs>
            <linearGradient id="brand-mark-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
              <stop stopColor="#3B82F6" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      <div className="brand-wordmark-block">
        <div className="brand-wordmark-line">
          <strong className="brand-wordmark-text">Banca</strong>
          <span className="brand-wordmark-plus-text">+</span>
        </div>
        {!compact && <span className="brand-tagline">Gestão de banca</span>}
      </div>
    </div>
  );
}
