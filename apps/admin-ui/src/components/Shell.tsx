import type { ReactNode } from "react";

export function Shell(props: { children: ReactNode }) {
  return (
    <div className="app">
      <div className="aurora" aria-hidden>
        <i className="orb orb-a" />
        <i className="orb orb-b" />
        <i className="orb orb-c" />
      </div>
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
            <h1>İzinli görünüm</h1>
            <p className="lede">Evrak yüklenmez. Kiracı kodu ile bağlanın; ajan onaydan sonra satır iter.</p>
          </div>
          <img className="wordmark-line" src="/brand/dijital-personel.png" alt="dijital personel" />
        </header>
        {props.children}
      </main>
    </div>
  );
}
