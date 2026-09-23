import { useEffect, useState } from "react";
import { Shell, type PageId } from "./components/Shell.tsx";
import { PrintVoucher } from "./pages/PrintVoucher.tsx";
import { View } from "./pages/View.tsx";

function pageFromHash(): PageId {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "yazdir") return "yazdir";
  return "gorunum";
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
      {page === "gorunum" ? <View /> : null}
      {page === "yazdir" ? <PrintVoucher /> : null}
    </Shell>
  );
}
