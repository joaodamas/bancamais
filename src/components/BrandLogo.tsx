type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bancaMarkTile" x1="3" y1="3" x2="37" y2="37" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FB923C" />
              <stop offset="1" stopColor="#F97316" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#bancaMarkTile)" />
          <rect x="2.5" y="2.5" width="35" height="35" rx="10.5" stroke="#FFFFFF" strokeOpacity="0.22" />
          <path
            d="M9.5 26.5 L16.5 21 L22 23.5 L30.5 13"
            stroke="#FFFFFF"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="30.5" cy="13" r="3.1" fill="#FFFFFF" />
        </svg>
      </span>
      <span className="brand-wordmark-block">
        <strong className="brand-wordmark-text">
          Banca<span className="brand-plus-char">+</span>
        </strong>
        {!compact && <span className="brand-tagline">Gestão de banca</span>}
      </span>
    </div>
  );
}
