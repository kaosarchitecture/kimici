import type { ReactNode } from "react";

export type PageId = "ai" | "yazdir";

const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "ai", href: "#/", label: "AI" },
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
        <p className="rail-note">Evrak buraya yüklenir. AI okur, fiş önerir, yazdırır. SQL yazmaz.</p>
      </aside>
      <main className="stage">
        <header className="top">
          <div>
            <h1>{props.page === "ai" ? "AI" : "Fiş yazdır"}</h1>
            <p className="lede">
              {props.page === "ai"
                ? "Model: Cloudflare Workers AI, denk-app Worker içinde. Evrak bu sunucuya yüklenir."
                : "Yalnızca yüklenen evraktan fiş çıkar."}
            </p>
          </div>
        </header>
        {props.children}
      </main>
    </div>
  );
}
