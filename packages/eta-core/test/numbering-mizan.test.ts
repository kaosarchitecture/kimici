import { describe, expect, it } from "vitest";
import { parentAccounts } from "../src/accounts.ts";
import { rollupMizan, topLevelDifference } from "../src/mizan.ts";
import { formatVoucherNo, nextRef, nextVoucherNo, parseVoucherNo } from "../src/numbering.ts";

describe("REF and voucher numbers", () => {
  it("takes the max of live header, live line and cancel archive (Ç2)", () => {
    expect(nextRef({ maxMuhfisRef: 1478, maxMuhharRef: 1479, maxCancelledRef: 2000 })).toBe(2001);
    expect(nextRef({ maxMuhfisRef: 0, maxMuhharRef: 0, maxCancelledRef: 0 })).toBe(1);
  });

  it("formats MA-000000 and uses live+cancel max (Ç3)", () => {
    expect(formatVoucherNo(28644)).toBe("MA-028644");
    expect(parseVoucherNo("MA-028643")).toBe(28643);
    expect(nextVoucherNo({ maxLiveSequence: 18970, maxCancelledSequence: 20000 })).toBe("MA-020001");
  });
});

describe("mizan rollup", () => {
  it("rolls leaf accounts to parents the way the approved script did", () => {
    expect(parentAccounts("191 02 20")).toEqual(["191 02", "191"]);
    expect(parentAccounts("320 A=014")).toEqual(["320"]);

    const mizan = rollupMizan([
      { account: "770 13", side: "D", amount: 3_549_638 },
      { account: "689 01", side: "D", amount: 1_825_528 },
      { account: "191 02 20", side: "D", amount: 709_928 },
      { account: "320 A=014", side: "C", amount: 6_085_094 },
      { account: "950 01", side: "D", amount: 1_825_528 },
      { account: "951 01", side: "C", amount: 1_825_528 },
    ]);

    expect(mizan.get("191 02 20")).toEqual({ debit: 709_928, credit: 0 });
    expect(mizan.get("191 02")).toEqual({ debit: 709_928, credit: 0 });
    expect(mizan.get("191")).toEqual({ debit: 709_928, credit: 0 });
    expect(mizan.get("320")).toEqual({ debit: 0, credit: 6_085_094 });
    expect(topLevelDifference(mizan)).toBe(0);
  });
});
