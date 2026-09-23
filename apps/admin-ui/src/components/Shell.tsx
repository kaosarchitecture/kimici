import type { ReactNode } from "react";

export type PageId = "gorunum" | "yazdir";

const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "gorunum", href: "#/", label: "Görünüm" },
  { id: "yazdir", href: "#/yazdir", label: "Fiş yazdır" },
];

export function Shell(props: { page: PageId; children: ReactNode }) {
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          DENK
          <span>Merkez</span>
        </div>
        <nav className="nav" aria-label="Sayfalar">
          {LINKS.map((link) => (
            <a key={link.id} href={link.href} className={props.page === link.id ? "active" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="rail-note">
          Defter müşteri Windows’unda kalır. Bu ekran yalnız ajanın ittiği izinli satırları gösterir.
        </p>
      </aside>
      <main className="stage">
        <header className="top">
          <div>
            <h1>{props.page === "gorunum" ? "İzinli görünüm" : "Fiş yazdır"}</h1>
            <p className="lede">
              {props.page === "gorunum"
                ? "Evrak yüklenmez. Kiracı kodu ile bağlanın; ajan onaydan sonra satır iter."
                : "Yalnız itilen izinli satırlardan fiş çıkar."}
            </p>
          </div>
        </header>
        {props.children}
      </main>
    </div>
  );
}
