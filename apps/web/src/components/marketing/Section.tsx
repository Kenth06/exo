import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export const Section = ({ id, title, lede, children, className = "" }: SectionProps) => (
  <section id={id} className={`mx-auto max-w-6xl border-t exo-border px-4 py-16 sm:px-6 ${className}`}>
    <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {lede && <p className="mt-2 text-sm exo-fg-soft">{lede}</p>}
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </div>
  </section>
);

export const PageHeader = ({ title, lede }: { title: ReactNode; lede?: ReactNode }) => (
  <header className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6">
    <h1 className="max-w-3xl text-4xl leading-[1.08] font-semibold sm:text-5xl">{title}</h1>
    {lede && <p className="mt-4 max-w-2xl text-lg exo-fg-soft">{lede}</p>}
  </header>
);

/** Two-column facts list used for specs: term on the left, value on the right. */
export const FactList = ({ items }: { items: Array<[string, ReactNode]> }) => (
  <dl className="divide-y exo-border border-y exo-border">
    {items.map(([term, value]) => (
      <div key={term} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
        <dt className="text-sm exo-fg-soft">{term}</dt>
        <dd className="text-sm tabular-nums">{value}</dd>
      </div>
    ))}
  </dl>
);
