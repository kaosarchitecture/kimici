import type { ReactNode } from "react";

export function Shell(props: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          DENK
          <span>AI</span>
        </div>
      </aside>
      <main className="stage">
        <header className="top">
          <h1>Bilgisayarlar</h1>
        </header>
        {props.children}
      </main>
    </div>
  );
}
