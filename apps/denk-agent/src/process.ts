import { formatPlanPreview } from "../../../packages/eta-core/src/preview.ts";
import { formatTr, parseTrAmount } from "../../../packages/eta-core/src/money.ts";
import { planPurchaseInvoice } from "../../../packages/eta-core/src/rules/purchase-invoice.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { documentFromFile, type UploadedDocument } from "../../../packages/consent-view/src/ubl.ts";
import type { ViewRecord } from "../../../packages/consent-view/src/types.ts";

export interface LocalResult {
  document: UploadedDocument;
  preview: string;
  blockers: string[];
  records: ViewRecord[];
}

/** Plan lines only. Invoice no / supplier / XML never become view fields. */
export function planToViewRecords(plan: VoucherPlan): ViewRecord[] {
  return plan.lines.map((line) => ({
    account: line.account,
    side: line.side === "D" ? "B" : "A",
    amountText: formatTr(line.amount),
    description: line.description,
    lineDate: String(line.lineDate).slice(0, 10),
    ruleId: line.ruleId,
  }));
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
    records: planToViewRecords(plan),
  };
}
