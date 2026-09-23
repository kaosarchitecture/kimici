import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/guards.ts";
import { cariTokens, classifyBankRow, lastDayOfMonth, planBankMonth, type BankRow, type SpecialBankRule } from "../src/rules/bank-statement.ts";

const SPECIAL: SpecialBankRule[] = [
  { id: "fee", keywords: ["Komisyon", "Masraf", "Faiz"], account: "770 27", label: "BANKA HİZMET GİDERLERİ" },
  { id: "phone", keywords: ["TTNET", "Türk Telekom"], account: "770 10", label: "TELEFON GİDERLERİ" },
  { id: "batch", keywords: ["Batch Yatan", "Batch Tutarı"], account: "100 01", label: "KASA" },
];

const CARIS = [
  { code: "320 D=010", name: "ÖRNEK MOTOR SERVİS A.Ş.", taxId: "1000000001" },
  { code: "120 H=001", name: "ÖRNEK MÜŞTERİ" },
];

function row(partial: Partial<BankRow> & Pick<BankRow, "date" | "amount">): BankRow {
  return { transactionType: "", description: "", docNo: "TX-1", ...partial };
}

describe("classifyBankRow (Kural 15)", () => {
  it("matches special types before cari", () => {
    const match = classifyBankRow(row({ date: "2026-04-02", amount: -837, transactionType: "Komisyon" }), {
      specialRules: SPECIAL,
      caris: CARIS,
    });
    expect(match.account).toBe("770 27");
    expect(match.ruleId).toBe("R15.special.fee");
  });

  it("matches cari by tax id, then by name tokens", () => {
    expect(cariTokens("ÖRNEK MOTOR SERVİS A.Ş.")).toEqual(["ÖRNEK", "MOTOR", "SERVİS"]);
    expect(
      classifyBankRow(row({ date: "2026-04-03", amount: -100_000, description: "VKN 1000000001 ödeme" }), {
        specialRules: SPECIAL,
        caris: CARIS,
      }).account,
    ).toBe("320 D=010");
    expect(
      classifyBankRow(row({ date: "2026-04-04", amount: 50_000, description: "ÖRNEK MÜŞTERİ tahsilat" }), {
        specialRules: SPECIAL,
        caris: CARIS,
      }).account,
    ).toBe("120 H=001");
  });

  it("falls back to 100 01 and never 296 (Ç1)", () => {
    const match = classifyBankRow(row({ date: "2026-04-05", amount: -1000, description: "bilinmeyen" }), {
      specialRules: SPECIAL,
      caris: CARIS,
    });
    expect(match.account).toBe("100 01");
    expect(() =>
      classifyBankRow(row({ date: "2026-04-05", amount: -1000, description: "x" }), {
        specialRules: [],
        caris: [],
        unmatchedAccount: "296 01",
      }),
    ).toThrow(/296/);
  });
});

describe("planBankMonth (Kural 02 + 18)", () => {
  it("builds one DEK voucher dated the last day, lines on their own dates", () => {
    expect(lastDayOfMonth(2026, 4)).toBe("2026-04-30");
    expect(lastDayOfMonth(2026, 5)).toBe("2026-05-31");

    const plan = planBankMonth({
      companyDb: "ETA_S00_2026",
      bankAccount: "102 12",
      year: 2026,
      month: 4,
      specialRules: SPECIAL,
      caris: CARIS,
      headerNote: "Banka ekstresi Nisan 2026",
      rows: [
        row({ date: "2026-04-30", amount: -8_370, transactionType: "Komisyon", description: "EFT komisyon", docNo: "K2" }),
        row({ date: "2026-04-02", amount: 301_500, description: "ÖRNEK MÜŞTERİ tahsilat", docNo: "G1" }),
        row({ date: "2026-04-15", amount: -150_000, description: "bilinmeyen ödeme", docNo: "C1" }),
      ],
    });

    expect(plan.kind).toBe("DEK");
    expect(plan.mode).toBe("monthly-single");
    expect(plan.headerDate).toBe("2026-04-30");
    expect(plan.lines).toHaveLength(6);
    expect(plan.lines.map((line) => line.lineDate)).toEqual([
      "2026-04-02", "2026-04-02", "2026-04-15", "2026-04-15", "2026-04-30", "2026-04-30",
    ]);
    expect(plan.lines[0]).toMatchObject({ account: "102 12", side: "D", amount: 301_500 });
    expect(plan.lines[1]).toMatchObject({ account: "120 H=001", side: "C", amount: 301_500 });
    expect(plan.lines[2]).toMatchObject({ account: "100 01", side: "D", amount: 150_000 });
    expect(plan.lines[3]).toMatchObject({ account: "102 12", side: "C", amount: 150_000 });
    expect(plan.lines[4]).toMatchObject({ account: "770 27", side: "D", amount: 8_370 });
    expect(plan.lines[5]).toMatchObject({ account: "102 12", side: "C", amount: 8_370 });
    expect(validatePlan(plan)).toEqual([]);
  });

  it("blocks mixed months and forbids 296 on the resulting plan", () => {
    const mixed = planBankMonth({
      companyDb: "ETA_S00_2026",
      bankAccount: "102 12",
      year: 2026,
      month: 4,
      specialRules: [],
      caris: [],
      rows: [row({ date: "2026-05-01", amount: 100, description: "geç" })],
    });
    expect(mixed.blockers.some((item) => item.code === "ROW_OUTSIDE_MONTH")).toBe(true);
    expect(validatePlan(mixed).some((item) => item.code === "BLOCKER.ROW_OUTSIDE_MONTH")).toBe(true);
  });
});
