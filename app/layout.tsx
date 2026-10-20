import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "Kommunkollen Stockholm",
  description: "Jämför Stockholms stadsdelsområden och grannskap: anmälda brott, polisens händelser och vilka som bor där. Öppna data från SCB, Brå och Polisen.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body className="antialiased min-h-screen flex flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Kommun<span className="text-accent">kollen</span>
              <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium">Stockholm</span>
            </Link>
            <nav className="flex gap-4 text-sm text-ink-2">
              <Link href="/" className="hover:text-ink">Karta</Link>
              <Link href="/jamfor" className="hover:text-ink">Jämför</Link>
              <Link href="/om" className="hover:text-ink">Om datan</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line py-6 text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4">
            Data: SCB, Brå, Polisen, Stockholms stad (stadsdelsgränser, CC0) samt OpenStreetMap-bidragsgivare.
            Hämtad via Sveriges dataportal och respektive myndighets öppna API:er.
          </div>
        </footer>
      </body>
    </html>
  );
}
