import type { ReactNode } from "react";

export type PageId = "ai" | "yazdir";

const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "ai", href: "#/", label: "Bilgisayarlar" },
  { id: "yazdir", href: "#/yazdir", label: "Fiş yazdır" },
];

export function Shell(props: { page: PageId; children: ReactNode }) {
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          DENK
          <span>AI</span>
        </div>
        <nav className="nav" aria-label="Sayfalar">
          {LINKS.map((link) => (
            <a key={link.id} href={link.href} className={props.page === link.id ? "active" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="stage">
        <header className="top">
          <h1>{props.page === "ai" ? "Bilgisayarlar" : "Fiş yazdır"}</h1>
        </header>
        {props.children}
      </main>
    </div>
  );
}
