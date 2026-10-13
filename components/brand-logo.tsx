/** The supplied logo is kept intact; these two windows show its mark and wordmark. */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo${compact ? ' brand-logo-compact' : ''}`} role="img" aria-label="ManageMe">
      <span className="brand-logo-mark" aria-hidden="true" />
      <span className="brand-logo-wordmark" aria-hidden="true" />
    </span>
  );
}
