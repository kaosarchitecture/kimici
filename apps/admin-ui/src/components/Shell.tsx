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
          <img className="brand-denk" src="/brand/denk.png" alt="DENK" />
          <span className="brand-rule" />
          <p className="brand-line">
            <span className="brand-dijital">dijital</span>
            <span className="brand-personel">personel</span>
            <i className="brand-dot" aria-hidden />
          </p>
          <p className="brand-by">by K.A.O.S. ARC.</p>
        </div>
        <nav className="nav" aria-label="Sayfalar">
          {LINKS.map((link) => (
            <a key={link.id} href={link.href} className={props.page === link.id ? "active" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="rail-foot">
          <p className="rail-note">
            Defter müşteri Windows’unda kalır. Bu ekran yalnız ajanın ittiği izinli satırları gösterir.
          </p>
          <img className="brand-kaos" src="/brand/kaos-arc.png" alt="K.A.O.S. ARC." />
        </div>
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
          <img className="wordmark-line" src="/brand/dijital-personel.png" alt="dijital personel" />
        </header>
        {props.children}
      </main>
    </div>
  );
}
