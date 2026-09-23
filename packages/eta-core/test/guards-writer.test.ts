import { describe, expect, it } from "vitest";
import { cp1254Hex } from "../src/cp1254.ts";
import { validatePlan } from "../src/guards.ts";
import { planPurchaseInvoice } from "../src/rules/purchase-invoice.ts";
import type { PlanLine, VoucherPlan } from "../src/types.ts";
import { buildVoucher, encodeField } from "../src/writer.ts";

function line(partial: Partial<PlanLine> & Pick<PlanLine, "seq" | "account" | "side" | "amount">): PlanLine {
  return {
    description: "DENEME",
    docNo: "DOC-1",
    lineDate: "2026-08-26",
    docDate: "2026-08-26",
    ruleId: "test",
    ...partial,
  };
}

function fat(lines: PlanLine[], extra: Partial<VoucherPlan> = {}): VoucherPlan {
  return {
    companyDb: "ETA_S00_2026",
    kind: "FAT",
    mode: "single-invoice",
    headerDate: "2026-08-26",
    lines,
    blockers: [],
    ...extra,
  };
}

describe("guards", () => {
  it("accepts a balanced invoice and rejects the known office failures", () => {
    const ok = fat([
      line({ seq: 1, account: "770 01", side: "D", amount: 100 }),
      line({ seq: 2, account: "100 01", side: "C", amount: 100 }),
    ]);
    expect(validatePlan(ok)).toEqual([]);

    expect(validatePlan(fat([
      line({ seq: 1, account: "770 01", side: "D", amount: 100 }),
      line({ seq: 2, account: "100 01", side: "C", amount: 90 }),
    ])).map((item) => item.code)).toContain("BALANCE");

    expect(validatePlan(fat([
      line({ seq: 1, account: "296 01", side: "D", amount: 100 }),
      line({ seq: 2, account: "102 01", side: "C", amount: 100 }),
    ])).map((item) => item.code)).toContain("NO_296");

    expect(validatePlan(fat([
      line({ seq: 1, account: "770 01", side: "D", amount: 100, description: "N.FT ILE ALIS" }),
      line({ seq: 2, account: "320 A=001", side: "C", amount: 100 }),
    ])).map((item) => item.code)).toContain("NO_ASCII_TURKISH");

    expect(validatePlan(fat([
      line({ seq: 1, account: "770 01", side: "D", amount: 100, description: "ALIM" }),
      line({ seq: 2, account: "100 01", side: "C", amount: 100 }),
    ])).map((item) => item.code)).toContain("NO_ALIM_TEXT");

    expect(validatePlan(fat([
      line({ seq: 1, account: "770 01", side: "D", amount: 3_000_000 }),
      line({ seq: 2, account: "100 01", side: "C", amount: 3_000_000 }),
    ])).map((item) => item.code)).toContain("FAT_30K_NOT_CASH");

    expect(validatePlan({
      companyDb: "ETA_S00_2026",
      kind: "DEK",
      mode: "monthly-single",
      headerDate: "2026-04-30",
      blockers: [],
      lines: [
        line({ seq: 1, account: "770 27", side: "D", amount: 100, description: "N.FT İLE ALIŞ", lineDate: "2026-04-02", docDate: "2026-04-02" }),
        line({ seq: 2, account: "102 12", side: "C", amount: 100, lineDate: "2026-04-02", docDate: "2026-04-02" }),
      ],
    }).map((item) => item.code)).toContain("BANK_NO_FAT_RULES");
  });

  it("enforces header-date and chronology rules", () => {
    expect(validatePlan({
      companyDb: "ETA_S00_2026",
      kind: "DEK",
      mode: "monthly-single",
      headerDate: "2026-04-15",
      blockers: [],
      lines: [
        line({ seq: 1, account: "102 12", side: "D", amount: 100, lineDate: "2026-04-02", docDate: "2026-04-02" }),
        line({ seq: 2, account: "100 01", side: "C", amount: 100, lineDate: "2026-04-02", docDate: "2026-04-02" }),
      ],
    }).map((item) => item.code)).toContain("HEADER_DATE_RULE");

    expect(validatePlan({
      companyDb: "ETA_S00_2026",
      kind: "DEK",
      mode: "monthly-single",
      headerDate: "2026-04-30",
      blockers: [],
      lines: [
        line({ seq: 1, account: "102 12", side: "D", amount: 100, lineDate: "2026-04-15", docDate: "2026-04-15" }),
        line({ seq: 2, account: "100 01", side: "C", amount: 100, lineDate: "2026-04-02", docDate: "2026-04-02" }),
      ],
    }).map((item) => item.code)).toContain("LINE_DATES_CHRONO");
  });
});

describe("writer template clone", () => {
  it("keeps office header codes from the template and overlays plan fields (Ç9)", () => {
    const plan = planPurchaseInvoice({
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
    });

    const built = buildVoucher({
      plan,
      refNo: 1479,
      voucherNo: "MA-028644",
      headerTemplate: {
        MUHFISHAZKOD: "02",
        MUHFISKONTKOD: "03",
        MUHFISONAYKOD: "04",
        MUHFISISYKOD: "MERKEZ",
        MUHFISKAYITONC: 4,
        MUHFISSEVNO: 1,
        MUHFISSAAT: "09:15",
        MUHFISKAYNAK: 25,
        EXTRA_OFFICE_COL: "keep-me",
      },
      lineTemplate: {
        MUHHARKAYNAK: 25,
        MUHHARMATATEFLAG: 1,
        MUHHARCINSI: 1,
        EXTRA_LINE_COL: "keep-line",
      },
    });

    expect(built.header.MUHFISHAZKOD).toBe("02");
    expect(built.header.MUHFISKONTKOD).toBe("03");
    expect(built.header.MUHFISONAYKOD).toBe("04");
    expect(built.header.MUHFISSAAT).toBe("09:15");
    expect(built.header.EXTRA_OFFICE_COL).toBe("keep-me");
    expect(built.header.MUHFISNO).toBe("MA-028644");
    expect(built.header.MUHFISREFNO).toBe(1479);
    expect(built.header.MUHFISBELTUR).toBe("FAT");
    expect(built.header.MUHFISBORCTOP).toBe(79106.22);
    expect(built.header.MUHFISALACAKTOP).toBe(79106.22);
    expect(built.header.MUHFISISYKOD).toBe("MERKEZ");

    const note = built.header.MUHFISEKCHAR2;
    if (typeof note !== "object" || note === null || !("encoding" in note)) throw new Error("expected cp1254");
    expect(encodeField(note).toString("hex").toUpperCase()).toBe(cp1254Hex("ALIM FATURASI"));

    const close = built.lines[3];
    expect(close?.MUHHARMUHKOD).toBe("320 A=014");
    expect(close?.MUHHARBATIPI).toBe(2);
    expect(close?.MUHHARTUTAR).toBe(60850.94);
    expect(close?.MUHHARVKNTCKNO).toBe(" ");
    expect(close?.EXTRA_LINE_COL).toBe("keep-line");
    const desc = close?.MUHHARACIKLAMA;
    if (typeof desc !== "object" || desc === null || !("encoding" in desc)) throw new Error("expected cp1254");
    expect(encodeField(desc).toString("hex").toUpperCase()).toBe("4E2E465420DD4C4520414C49DE");

    const expense = built.lines[0];
    const aciklama2 = expense?.MUHHARACIKLAMA2;
    if (typeof aciklama2 !== "object" || aciklama2 === null || !("encoding" in aciklama2)) throw new Error("expected cp1254");
    expect(encodeField(aciklama2).toString("hex").toUpperCase()).toBe(cp1254Hex("ARAÇ BAKIM ONARIM"));
  });
});
