/**
 * ManageMe logo: the icon plus wordmark, cut out of the supplied artwork with transparent
 * backgrounds. Dark themes swap in a variant whose lettering is white (via CSS on the theme root).
 */
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-logo${compact ? ' brand-logo-compact' : ''}`} role="img" aria-label="ManageMe">
      <img className="brand-logo-mark brand-logo-light" src="/brand/mark.png" alt="" width={105} height={96} decoding="async" />
      <img className="brand-logo-mark brand-logo-dark" src="/brand/mark-dark.png" alt="" width={105} height={96} decoding="async" />
      <img className="brand-logo-wordmark brand-logo-light" src="/brand/wordmark.png" alt="" width={392} height={72} decoding="async" />
      <img className="brand-logo-wordmark brand-logo-dark" src="/brand/wordmark-dark.png" alt="" width={392} height={72} decoding="async" />
    </span>
  );
}
