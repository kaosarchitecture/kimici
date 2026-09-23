export interface Evrak {
  fileName: string;
  mime: string;
  size: number;
  receivedAt: string;
  kind: "ubl-invoice" | "file";
  invoiceNo: string;
  issueDate: string;
  supplierName: string;
  netText: string;
  vatText: string;
  payableText: string;
}
