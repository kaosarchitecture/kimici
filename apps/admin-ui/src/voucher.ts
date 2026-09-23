import type { Evrak } from "./pages/types.ts";

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

export function voucherFromEvrak(doc: Evrak): PrintVoucher {
  const date = trDate(doc.issueDate);
  const name = doc.supplierName || doc.fileName;
  const lines: PrintLine[] = [];
  if (doc.netText) {
    lines.push({ seq: 1, account: "770 01", side: "B", amountText: doc.netText, description: name, date });
  }
  if (doc.vatText) {
    lines.push({
      seq: lines.length + 1,
      account: "191 02 20",
      side: "B",
      amountText: doc.vatText,
      description: "İND.KDV.",
      date,
    });
  }
  if (doc.payableText) {
    lines.push({
      seq: lines.length + 1,
      account: "320",
      side: "A",
      amountText: doc.payableText,
      description: "N.FT İLE ALIŞ",
      date,
    });
  }
  if (lines.length === 0) {
    lines.push({
      seq: 1,
      account: "—",
      side: "B",
      amountText: "—",
      description: doc.fileName,
      date: date || "—",
    });
  }
  return {
    company: doc.supplierName || "",
    kind: doc.kind === "ubl-invoice" ? "Alış faturası (FAT)" : "Yüklenen evrak",
    number: doc.invoiceNo,
    date,
    note: doc.fileName,
    debit: doc.payableText,
    credit: doc.payableText,
    lines,
  };
}
