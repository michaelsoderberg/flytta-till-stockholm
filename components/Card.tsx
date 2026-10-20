export default function Card({
  id,
  title,
  subtitle,
  source,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: React.ReactNode;
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 rounded-xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      <div className="mt-4">{children}</div>
      {source && <p className="mt-4 text-xs text-muted">Källa: {source}</p>}
    </section>
  );
}
