import { formatPlanPreview } from "../../../packages/eta-core/src/preview.ts";
import { formatTr, parseTrAmount } from "../../../packages/eta-core/src/money.ts";
import { planPurchaseInvoice } from "../../../packages/eta-core/src/rules/purchase-invoice.ts";
import { totals } from "../../../packages/eta-core/src/types.ts";
import type { DeskVoucher } from "../../../packages/consent-view/src/desk.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { documentFromFile, type UploadedDocument } from "../../../packages/consent-view/src/ubl.ts";

export interface LocalFields {
  sourceName: string;
  sourceKind: "xml" | "audit" | "log";
  invoiceNo: string;
  issueDate: string;
  supplierName: string;
  netText: string;
  vatText: string;
  payableText: string;
}

export interface LocalResult {
  document: UploadedDocument;
  preview: string;
  blockers: string[];
  voucher: DeskVoucher;
}

export function planLocalFields(fields: LocalFields, pack: KnowledgePack): DeskVoucher {
  const invoiceNo = fields.invoiceNo.trim();
  const issueDate = fields.issueDate.trim();
  if (!invoiceNo || !issueDate) throw new Error("Evrak no veya tarih yok.");
  const net = parseTrAmount(fields.netText);
  const vat = parseTrAmount(fields.vatText);
  const payable = parseTrAmount(fields.payableText);
  const plan = planPurchaseInvoice({
    companyDb: "LOCAL",
    invoiceNo,
    issueDate,
    supplierName: fields.supplierName.trim(),
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
  const { debit, credit } = totals(plan.lines);
  return {
    sourceName: fields.sourceName,
    sourceKind: fields.sourceKind,
    invoiceNo,
    date: issueDate,
    supplierName: fields.supplierName.trim(),
    debit: formatTr(debit),
    credit: formatTr(credit),
    preview: formatPlanPreview(plan),
    blockers: plan.blockers.map((item) => item.message),
    lines: plan.lines.map((line) => ({
      seq: line.seq,
      account: line.account,
      side: line.side === "D" ? "B" : "A",
      amountText: formatTr(line.amount),
      description: line.description,
      date: line.lineDate,
    })),
  };
}

export function processLocalEvrak(fileName: string, mime: string, xml: string, pack: KnowledgePack): LocalResult {
  const document = documentFromFile(fileName, mime, xml.length, xml);
  const voucher = planLocalFields(
    {
      sourceName: fileName,
      sourceKind: "xml",
      invoiceNo: document.invoiceNo || fileName,
      issueDate: document.issueDate,
      supplierName: document.supplierName || fileName,
      netText: document.netText,
      vatText: document.vatText,
      payableText: document.payableText,
    },
    pack,
  );
  return { document, preview: voucher.preview, blockers: voucher.blockers, voucher };
}
