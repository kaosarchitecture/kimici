export interface UploadedDocument {
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

function tag(xml: string, local: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}\\b[^>]*>([^<]*)</(?:[\\w.-]+:)?${local}>`, "i");
  return (re.exec(xml)?.[1] ?? "").trim();
}

function formatTrFromPlain(raw: string): string {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num)) return raw || "0,00";
  const kurus = Math.round(num * 100);
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  const whole = String(Math.floor(abs / 100));
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${frac}`;
}

export function parseUblInvoice(xml: string, fileName: string, mime: string, size: number): UploadedDocument {
  const invoiceNo = tag(xml, "ID");
  const issueDate = tag(xml, "IssueDate");
  const supplierName = tag(xml, "Name") || tag(xml, "RegistrationName");
  const net = tag(xml, "TaxExclusiveAmount");
  const vat = tag(xml, "TaxAmount");
  const payable = tag(xml, "PayableAmount");
  const looksUbl = /Invoice/i.test(xml) && Boolean(invoiceNo || payable);
  return {
    fileName,
    mime,
    size,
    receivedAt: new Date().toISOString(),
    kind: looksUbl ? "ubl-invoice" : "file",
    invoiceNo,
    issueDate,
    supplierName,
    netText: formatTrFromPlain(net),
    vatText: formatTrFromPlain(vat),
    payableText: formatTrFromPlain(payable),
  };
}

export function documentFromFile(fileName: string, mime: string, size: number, xml?: string): UploadedDocument {
  if (xml && /<\w/.test(xml)) return parseUblInvoice(xml, fileName, mime, size);
  return {
    fileName,
    mime,
    size,
    receivedAt: new Date().toISOString(),
    kind: "file",
    invoiceNo: "",
    issueDate: "",
    supplierName: "",
    netText: "",
    vatText: "",
    payableText: "",
  };
}
