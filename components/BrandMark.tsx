/** Speech-bubble mark drawn for this app (not the LINE logo). */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="2" y="3" width="20" height="15" rx="5" fill="currentColor" />
      <path d="M8 18 L8 22 L13 18 Z" fill="currentColor" />
      <rect x="6.5" y="8" width="11" height="1.8" rx="0.9" fill="var(--ramp-0)" />
      <rect x="6.5" y="11.4" width="7" height="1.8" rx="0.9" fill="var(--ramp-0)" />
    </svg>
  );
}
