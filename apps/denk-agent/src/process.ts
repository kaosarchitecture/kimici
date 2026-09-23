import { formatPlanPreview } from "../../../packages/eta-core/src/preview.ts";
import { parseTrAmount } from "../../../packages/eta-core/src/money.ts";
import { planPurchaseInvoice } from "../../../packages/eta-core/src/rules/purchase-invoice.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { documentFromFile, type UploadedDocument } from "../../../packages/consent-view/src/ubl.ts";

export interface LocalResult {
  document: UploadedDocument;
  preview: string;
  blockers: string[];
}

export function processLocalEvrak(fileName: string, mime: string, xml: string, pack: KnowledgePack): LocalResult {
  const document = documentFromFile(fileName, mime, xml.length, xml);
  const net = document.netText ? parseTrAmount(document.netText) : 0;
  const vat = document.vatText ? parseTrAmount(document.vatText) : 0;
  const payable = document.payableText ? parseTrAmount(document.payableText) : 0;
  const plan = planPurchaseInvoice({
    companyDb: "LOCAL",
    invoiceNo: document.invoiceNo || fileName,
    issueDate: (document.issueDate || "1970-01-01") as `${number}-${number}-${number}`,
    supplierName: document.supplierName || fileName,
    netAmount: net,
    vatAmount: vat,
    payableAmount: payable,
    category: "general-expense",
    vatAccount: pack.vatAccount,
    supplierAccount: payable >= pack.nftThresholdKurus ? "320" : null,
    expenseAccount: pack.expenseAccount,
    cashAccount: pack.cashAccount,
    vatDescription: pack.vatDescription,
  });
  return {
    document,
    preview: formatPlanPreview(plan),
    blockers: plan.blockers.map((item) => item.message),
  };
}
