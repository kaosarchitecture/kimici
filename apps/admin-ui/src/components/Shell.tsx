import type { ReactNode } from "react";
import { STATUS_LABELS } from "../labels.ts";
import type { HubStatus } from "../types.ts";

export type PageId = "calisma" | "onay" | "ajan";

const LINKS: { id: PageId; href: string; label: string }[] = [
  { id: "calisma", href: "#/", label: "Çalışma" },
  { id: "onay", href: "#/onay", label: "Windows onayı" },
  { id: "ajan", href: "#/ajan", label: "Ajan" },
];

function pillClass(status: HubStatus): string {
  if (status === "ready" || status === "granted") return "ok";
  if (status === "denied" || status === "revoked" || status === "expired") return "bad";
  if (status === "pending" || status === "prompted") return "wait";
  return "";
}

export function Shell(props: {
  page: PageId;
  title: string;
  lede: string;
  status: HubStatus;
  children: ReactNode;
}) {
  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          DENK
          <span>Merkez çalışma alanı</span>
        </div>
        <nav className="nav" aria-label="Sayfalar">
          {LINKS.map((link) => (
            <a key={link.id} href={link.href} className={props.page === link.id ? "active" : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="rail-note">
          Ajan bize bağlanır. Bu arayüz DENKWEB değildir; izinli fişi Windows onayıyla gösterir.
        </p>
      </aside>
      <main className="stage">
        <header className="top">
          <div>
            <h1>{props.title}</h1>
            <p className="lede">{props.lede}</p>
          </div>
          <span className={`pill ${pillClass(props.status)}`}>{STATUS_LABELS[props.status]}</span>
        </header>
        {props.children}
      </main>
    </div>
  );
}
