/** Sticky in-page navigation for long area pages. */
export default function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  return (
    <nav
      aria-label="Avsnitt"
      className="sticky top-[env(safe-area-inset-top,0px)] z-[1000] -mx-4 overflow-x-auto border-b border-line bg-page/95 px-4 py-2 backdrop-blur"
    >
      <ul className="flex gap-1 whitespace-nowrap text-sm">
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className="block rounded-full px-3 py-1 text-ink-2 hover:bg-surface hover:text-ink">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
