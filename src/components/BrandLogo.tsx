type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <span className="brand-wordmark-block">
        <strong className="brand-wordmark-text">
          Banca<span className="brand-plus-char" aria-hidden="true" />
        </strong>
        {!compact && <span className="brand-tagline">Gestão de banca</span>}
      </span>
    </div>
  );
}
