import type { ViewPayload } from "./pages/types.ts";

export interface PrintLine {
  seq: number;
  account: string;
  side: "B" | "A";
  amountText: string;
  description: string;
  date: string;
}

export interface PrintVoucher {
  company: string;
  kind: string;
  number: string;
  date: string;
  note: string;
  debit: string;
  credit: string;
  lines: PrintLine[];
}

function trDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/** Print only agent-pushed permitted fields. Invoice XML never reaches this page. */
export function voucherFromView(view: ViewPayload): PrintVoucher {
  const lines: PrintLine[] = view.records.map((row, index) => ({
    seq: index + 1,
    account: row.account ?? "—",
    side: row.side === "A" ? "A" : "B",
    amountText: row.amountText ?? "—",
    description: row.description ?? "",
    date: row.lineDate ? trDate(row.lineDate) : "",
  }));
  return {
    company: "",
    kind: "Fiş planı önizlemesi",
    number: "",
    date: lines[0]?.date ?? "",
    note: "Yalnız Windows onayıyla itilen alanlar",
    debit: "",
    credit: "",
    lines,
  };
}
