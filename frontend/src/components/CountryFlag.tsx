/**
 * Renders an emoji flag from an ISO-2 country code (e.g. "IN" -> 🇮🇳) without
 * needing a lookup table. Falls back to a globe for unknown codes.
 */
export function CountryFlag({
  code,
  className = '',
}: {
  code?: string | null;
  className?: string;
}) {
  if (!code || code.length !== 2) return <span className={className}>🌐</span>;
  const flag = String.fromCodePoint(
    ...code
      .toUpperCase()
      .split('')
      .map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65))
  );
  return (
    <span className={className} aria-label={code}>
      {flag}
    </span>
  );
}
