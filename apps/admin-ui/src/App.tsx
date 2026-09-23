import { useEffect, useState } from "react";
import { Shell, type PageId } from "./components/Shell.tsx";
import { Desk } from "./pages/Desk.tsx";
import { PrintVoucher } from "./pages/PrintVoucher.tsx";

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "yazdir") return "yazdir";
  return "ai";
}

export function App() {
  const [page, setPage] = useState<PageId>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <Shell page={page}>
      {page === "ai" ? <Desk /> : null}
      {page === "yazdir" ? <PrintVoucher /> : null}
    </Shell>
  );
}
