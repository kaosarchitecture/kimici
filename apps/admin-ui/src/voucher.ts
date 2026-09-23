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

/** Sample voucher the server can print. Not written to anyone's ETA. */
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
