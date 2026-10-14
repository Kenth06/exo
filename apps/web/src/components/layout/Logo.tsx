import { Link } from "react-router";

export const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="Exo home">
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-[var(--exo-fg)]" />
      <g fill="none" stroke="var(--exo-accent)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9 22h14" />
        <path d="M10 18h12" />
        <path d="M11 14h10" />
        <path d="M12 10h8" />
      </g>
    </svg>
    <span className="text-lg font-semibold">Exo</span>
  </Link>
);
