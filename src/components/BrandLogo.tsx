type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={compact ? "brand-logo compact" : "brand-logo"} aria-label="Banca+">
      <div className="brand-symbol-box" aria-hidden="true">
        B+
      </div>
      {!compact && (
        <div>
          <strong>Banca+</strong>
          <span>Controle profissional</span>
        </div>
      )}
    </div>
  );
}
