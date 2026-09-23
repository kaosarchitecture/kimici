import { useEffect, useState } from "react";
import { Shell, type PageId } from "./components/Shell.tsx";
import { Agent } from "./pages/Agent.tsx";
import { PrintVoucher } from "./pages/PrintVoucher.tsx";
import { WindowsConsent } from "./pages/WindowsConsent.tsx";
import { Workspace } from "./pages/Workspace.tsx";
import { useHub } from "./useHub.ts";

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "calisma") return "calisma";
  if (hash === "onay") return "onay";
  if (hash === "ajan") return "ajan";
  return "yazdir";
}

const COPY: Record<PageId, { title: string; lede: string }> = {
  yazdir: {
    title: "Fiş yazdır",
    lede: "Sunucuda yazılmış örnek alış fişi. Bu sayfayı başka bir bilgisayardan açıp yazdırın.",
  },
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
      {page === "yazdir" ? <PrintVoucher /> : null}
      {page === "calisma" ? <Workspace state={state} /> : null}
      {page === "onay" ? <WindowsConsent state={state} /> : null}
      {page === "ajan" ? <Agent /> : null}
    </Shell>
  );
}
