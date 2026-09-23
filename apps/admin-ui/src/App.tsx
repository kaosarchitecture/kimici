import { useEffect, useState } from "react";
import { Shell, type PageId } from "./components/Shell.tsx";
import { Agent } from "./pages/Agent.tsx";
import { WindowsConsent } from "./pages/WindowsConsent.tsx";
import { Workspace } from "./pages/Workspace.tsx";
import { useHub } from "./useHub.ts";

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "onay") return "onay";
  if (hash === "ajan") return "ajan";
  return "calisma";
}

const COPY: Record<PageId, { title: string; lede: string }> = {
  calisma: {
    title: "Çalışma",
    lede: "AI fişi görmek için Windows yetkisi ister. Onaydan sonra ajan izinli satırları bu sayfaya iter.",
  },
  onay: {
    title: "Windows onayı",
    lede: "Bu yüzey ajanın kullanıcı makinesindeki onay penceresidir. Parola yoktur.",
  },
  ajan: {
    title: "Ajan",
    lede: "Herhangi bir makine bize bağlanır. Biz bir ofis PC’sine gitmeyiz.",
  },
};

export function App() {
  const state = useHub();
  const [page, setPage] = useState<PageId>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const copy = COPY[page];
  return (
    <Shell page={page} title={copy.title} lede={copy.lede} status={state.status}>
      {page === "calisma" ? <Workspace state={state} /> : null}
      {page === "onay" ? <WindowsConsent state={state} /> : null}
      {page === "ajan" ? <Agent /> : null}
    </Shell>
  );
}
