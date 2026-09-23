import { describe, expect, it } from "vitest";
import { combineDateAndTime, datePart, lastDayOfMonth, toNaiveSqlDate } from "../src/datetime.ts";
import { validatePlan } from "../src/guards.ts";
import { planBankMonth, type BankRow } from "../src/rules/bank-statement.ts";
import { buildVoucher } from "../src/writer.ts";

function row(partial: Partial<BankRow> & Pick<BankRow, "date" | "amount">): BankRow {
  return { transactionType: "", description: "hareket", docNo: "TX", ...partial };
}

describe("Kural 18 tek mahsup tarihi", () => {
  it("keeps the original clock on lines and puts only the header on the last day", () => {
    expect(combineDateAndTime("2026-04-02", "9:15")).toBe("2026-04-02T09:15:00");
    expect(lastDayOfMonth(2026, 4)).toBe("2026-04-30");

    const plan = planBankMonth({
      companyDb: "ETA_S00_2026",
      bankAccount: "102 12",
      year: 2026,
      month: 4,
      specialRules: [],
      caris: [],
      rows: [
        row({ date: "2026-04-30", time: "23:50", amount: -1_000, description: "ay sonu", docNo: "L" }),
        row({ date: "2026-04-02", time: "09:15", amount: 2_000, description: "ay başı", docNo: "A" }),
        row({ date: "2026-04-15T14:32:00", amount: -500, description: "ay ortası", docNo: "M" }),
      ],
    });

    expect(plan.headerDate).toBe("2026-04-30");
    expect(plan.lines.map((line) => line.lineDate)).toEqual([
      "2026-04-02T09:15:00",
      "2026-04-02T09:15:00",
      "2026-04-15T14:32:00",
      "2026-04-15T14:32:00",
      "2026-04-30T23:50:00",
      "2026-04-30T23:50:00",
    ]);
    expect(plan.lines.every((line) => line.lineDate === line.docDate)).toBe(true);
    expect(plan.lines.some((line) => datePart(line.lineDate) !== plan.headerDate)).toBe(true);
    expect(validatePlan(plan)).toEqual([]);

    const built = buildVoucher({
      plan,
      refNo: 1,
      voucherNo: "MA-000001",
      headerTemplate: { MUHFISISYKOD: "MERKEZ" },
      lineTemplate: {},
    });
    const header = built.header.MUHFISTAR;
    const firstLine = built.lines[0]?.MUHHARTAR;
    const firstDoc = built.lines[0]?.MUHHAREVRAKTAR;
    if (!(header instanceof Date) || !(firstLine instanceof Date) || !(firstDoc instanceof Date)) {
      throw new Error("expected Date values");
    }
    expect(header.toISOString()).toBe(toNaiveSqlDate("2026-04-30").toISOString());
    expect(firstLine.toISOString()).toBe(toNaiveSqlDate("2026-04-02T09:15:00").toISOString());
    expect(firstDoc.toISOString()).toBe(firstLine.toISOString());
    expect(firstLine.getUTCHours()).toBe(9);
    expect(firstLine.getUTCMinutes()).toBe(15);
    expect(header.getUTCDate()).toBe(30);
    expect(header.getUTCHours()).toBe(0);
  });

  it("rejects copying the last day onto every line", () => {
    const plan = planBankMonth({
      companyDb: "ETA_S00_2026",
      bankAccount: "102 12",
      year: 2026,
      month: 4,
      specialRules: [],
      caris: [],
      rows: [
        row({ date: "2026-04-02", amount: 100, docNo: "1" }),
        row({ date: "2026-04-03", amount: -100, docNo: "2" }),
      ],
    });
    const stamped = {
      ...plan,
      lines: plan.lines.map((line) => ({ ...line, lineDate: "2026-04-30", docDate: "2026-04-30" })),
    };
    expect(validatePlan(stamped).map((item) => item.code)).toContain("LINE_KEEPS_ORIGINAL_TIME");
  });
});
