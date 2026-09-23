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

export interface EvrakFields {
  fileName: string;
  kind: string;
  invoiceNo: string;
  issueDate: string;
  supplierName: string;
  netText: string;
  vatText: string;
  payableText: string;
}

function trDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "—";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function voucherFromEvrak(doc: EvrakFields): PrintVoucher {
  const date = trDate(doc.issueDate);
  const name = doc.supplierName || doc.fileName;
  const lines: PrintLine[] = [];
  if (doc.netText) {
    lines.push({ seq: 1, account: "770 01", side: "B", amountText: doc.netText, description: name, date });
  }
  if (doc.vatText) {
    lines.push({ seq: lines.length + 1, account: "191 02 20", side: "B", amountText: doc.vatText, description: "İND.KDV.", date });
  }
  if (doc.payableText) {
    lines.push({ seq: lines.length + 1, account: "320 A=014", side: "A", amountText: doc.payableText, description: "N.FT İLE ALIŞ", date });
  }
  if (lines.length === 0) {
    lines.push({
      seq: 1,
      account: "—",
      side: "B",
      amountText: "—",
      description: `Alındı: ${doc.fileName}`,
      date: date === "—" ? new Date().toLocaleDateString("tr-TR") : date,
    });
  }
  return {
    company: "ÖRNEK ŞİRKET A",
    kind: doc.kind === "ubl-invoice" ? "Alış faturası (FAT)" : "Yüklenen evrak",
    number: doc.invoiceNo || "MA-000001",
    date: date === "—" ? new Date().toLocaleDateString("tr-TR") : date,
    note: doc.invoiceNo ? "ALIM FATURASI" : doc.fileName,
    debit: doc.payableText || "—",
    credit: doc.payableText || "—",
    lines,
  };
}

/** Sample voucher used only when nothing was uploaded yet. */
export const PRINT_VOUCHER: PrintVoucher = {
  company: "ÖRNEK ŞİRKET A",
  kind: "Alış faturası (FAT)",
  number: "MA-000001",
  date: "26.08.2026",
  note: "ALIM FATURASI",
  debit: "79.106,22",
  credit: "79.106,22",
  lines: [
    { seq: 1, account: "770 13", side: "B", amountText: "35.496,38", description: "ÖRNEK MOTOR SERVİS A.Ş. - ÖRNEK ŞUBE", date: "26.08.2026" },
    { seq: 2, account: "689 01", side: "B", amountText: "18.255,28", description: "ÖRNEK MOTOR SERVİS A.Ş. - ÖRNEK ŞUBE", date: "26.08.2026" },
    { seq: 3, account: "191 02 20", side: "B", amountText: "7.099,28", description: "İND.KDV.", date: "26.08.2026" },
    { seq: 4, account: "320 A=014", side: "A", amountText: "60.850,94", description: "N.FT İLE ALIŞ", date: "26.08.2026" },
    { seq: 5, account: "950 01", side: "B", amountText: "18.255,28", description: "K.K.E.GİDERLER", date: "26.08.2026" },
    { seq: 6, account: "951 01", side: "A", amountText: "18.255,28", description: "K.K.E.GİDERLER", date: "26.08.2026" },
  ],
};
