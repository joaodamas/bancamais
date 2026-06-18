type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <div className="brand-wordmark-block">
        <strong className="brand-wordmark-text">
          Banca<span className="brand-plus-char">+</span>
        </strong>
        {!compact && <span className="brand-tagline">Gestão de banca</span>}
      </div>
    </div>
  );
}
