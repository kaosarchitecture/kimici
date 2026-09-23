import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/guards.ts";
import { formatTr } from "../src/money.ts";
import { formatPlanPreview } from "../src/preview.ts";
import { NFT_THRESHOLD, planPurchaseInvoice, type PurchaseInvoiceInput } from "../src/rules/purchase-invoice.ts";
import { totals } from "../src/types.ts";

const GOLDEN: PurchaseInvoiceInput = {
  companyDb: "ETA_S00_2026",
  invoiceNo: "INV2026000002000",
  issueDate: "2026-08-26",
  supplierName: "ÖRNEK MOTOR SERVİS A.Ş. - ÖRNEK ŞUBE",
  netAmount: 5_070_911,
  vatAmount: 1_014_183,
  payableAmount: 6_085_094,
  category: "passenger-car-service",
  vatAccount: "191 02 20",
  supplierAccount: "320 A=014",
  item: "ARAÇ BAKIM ONARIM",
  unit: "ADET",
  quantity: 1,
};

describe("golden purchase invoice (Kural 13 + 16 + 19)", () => {
  it("reproduces the approved six-line voucher to the kuruş", () => {
    const plan = planPurchaseInvoice(GOLDEN);
    expect(plan.blockers).toEqual([]);
    expect(plan.kind).toBe("FAT");
    expect(plan.mode).toBe("single-invoice");
    expect(plan.headerDate).toBe("2026-08-26");
    expect(plan.specialCode1).toBe("ALF");
    expect(plan.headerNote).toBe("ALIM FATURASI");
    expect(validatePlan(plan)).toEqual([]);

    const expected = [
      { seq: 1, account: "770 13", side: "D", amount: 3_549_638, description: GOLDEN.supplierName, specialCode: "INDKDV" },
      { seq: 2, account: "689 01", side: "D", amount: 1_825_528, description: GOLDEN.supplierName, specialCode: "INDKDV" },
      { seq: 3, account: "191 02 20", side: "D", amount: 709_928, description: "İND. KDV", specialCode: "INDKDV" },
      { seq: 4, account: "320 A=014", side: "C", amount: 6_085_094, description: "N.FT İLE ALIŞ" },
      { seq: 5, account: "950 01", side: "D", amount: 1_825_528, description: "K.K.E.GİDERLER" },
      { seq: 6, account: "951 01", side: "C", amount: 1_825_528, description: "K.K.E.GİDERLER" },
    ];
    expect(plan.lines.map(({ seq, account, side, amount, description, specialCode }) => ({
      seq, account, side, amount, description, ...(specialCode ? { specialCode } : {}),
    }))).toEqual(expected);

    const { debit, credit } = totals(plan.lines);
    expect(debit).toBe(7_910_622);
    expect(credit).toBe(7_910_622);
    expect(formatTr(debit)).toBe("79.106,22");
    expect(plan.lines[0]?.detail).toEqual({
      reference: "(320 A=014)",
      item: "ARAÇ BAKIM ONARIM",
      unit: "ADET",
      quantity: 1,
    });
    expect(formatPlanPreview(plan)).toContain("N.FT İLE ALIŞ");
  });
});

describe("Kural 13 closing table", () => {
  const base = {
    companyDb: "ETA_S00_2026",
    invoiceNo: "INV-1",
    issueDate: "2026-08-01",
    supplierName: "GALİP TİCARET",
    netAmount: 1_000_000,
    vatAmount: 200_000,
    payableAmount: 1_200_000,
    category: "general-expense" as const,
    vatAccount: "191 02 20",
    expenseAccount: "770 01",
  };

  it("≥30k + existing cari → 320 and N.FT İLE ALIŞ", () => {
    const plan = planPurchaseInvoice({
      ...base,
      payableAmount: NFT_THRESHOLD,
      netAmount: 2_500_000,
      vatAmount: 500_000,
      supplierAccount: "320 B=001",
    });
    const close = plan.lines.find((line) => line.side === "C");
    expect(close?.account).toBe("320 B=001");
    expect(close?.description).toBe("N.FT İLE ALIŞ");
    expect(validatePlan(plan)).toEqual([]);
  });

  it("≥30k + no cari → blocker, never cash", () => {
    const plan = planPurchaseInvoice({
      ...base,
      payableAmount: NFT_THRESHOLD,
      netAmount: 2_500_000,
      vatAmount: 500_000,
      supplierAccount: null,
    });
    expect(plan.blockers.some((item) => item.code === "NEW_SUPPLIER_ACCOUNT_REQUIRED")).toBe(true);
    expect(validatePlan(plan).some((item) => item.code === "FAT_30K_NOT_CASH" || item.code.endsWith("NEW_SUPPLIER_ACCOUNT_REQUIRED"))).toBe(true);
  });

  it("<30k + existing cari → 320 and supplier name, no N.FT", () => {
    const plan = planPurchaseInvoice({ ...base, supplierAccount: "320 C=009" });
    const close = plan.lines.find((line) => line.side === "C");
    expect(close?.account).toBe("320 C=009");
    expect(close?.description).toBe("GALİP TİCARET");
    expect(validatePlan(plan)).toEqual([]);
  });

  it("<30k + no cari → 100 01 and supplier name", () => {
    const plan = planPurchaseInvoice({ ...base, supplierAccount: null });
    const close = plan.lines.find((line) => line.side === "C");
    expect(close?.account).toBe("100 01");
    expect(close?.description).toBe("GALİP TİCARET");
    expect(validatePlan(plan)).toEqual([]);
  });

  it("stops when the supplier name is missing (ALIM is forbidden)", () => {
    const plan = planPurchaseInvoice({ ...base, supplierName: "  ", supplierAccount: "320 C=009" });
    expect(plan.blockers.some((item) => item.code === "SUPPLIER_NAME_MISSING")).toBe(true);
  });
});
