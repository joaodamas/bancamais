type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <svg className="brand-symbol" viewBox="0 0 96 96" role="img" aria-hidden="true">
        <defs>
          <linearGradient id="brand-gradient" x1="16" y1="16" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9d8fff" />
            <stop offset="1" stopColor="#7c6af7" />
          </linearGradient>
        </defs>
        <rect className="symbol-bg" x="8" y="8" width="80" height="80" rx="22" />
        <path
          className="symbol-b"
          d="M31 67V29H50.5C58.2 29 63.5 33.4 63.5 40.1C63.5 44.1 61.5 47.2 58.2 48.9C62.5 50.4 65 53.8 65 58.2C65 65.1 59.5 67 51.1 67H31ZM41.1 44.9H49.2C52 44.9 53.8 43.4 53.8 40.9C53.8 38.5 52.1 37 49.2 37H41.1V44.9ZM41.1 59H50.2C53.3 59 55.2 57.5 55.2 54.8C55.2 52.2 53.3 50.7 50.2 50.7H41.1V59Z"
        />
        <path className="symbol-plus" d="M66 26V36H76V43H66V53H59V43H49V36H59V26H66Z" />
        <path className="symbol-line" d="M25 70L37 58L47 64L70 41" />
      </svg>
      {!compact && (
        <div>
          <strong>Banca+</strong>
          <span>Controle profissional</span>
        </div>
      )}
    </div>
  );
}
