import { describe, expect, it } from "vitest";
import { filterRecords, sanitizeFields } from "../src/filter.ts";

describe("filterRecords", () => {
  it("keeps only granted fields and drops secrets", () => {
    const rows = filterRecords(
      [
        {
          account: "191 02 20",
          side: "B",
          amountText: "7.099,28",
          description: "İND.KDV.",
          lineDate: "2026-08-26",
          ruleId: "R16.vat",
          supplierVkn: "1111111111",
          extra: "nope",
        },
      ],
      ["account", "description", "amountText"],
    );
    expect(rows).toEqual([
      { account: "191 02 20", amountText: "7.099,28", description: "İND.KDV." },
    ]);
  });

  it("rejects a record that smuggles a password key", () => {
    expect(() =>
      filterRecords([{ account: "100 01", password: "x" }], ["account"]),
    ).toThrow(/gönderilemez/);
  });

  it("sanitizes unknown field names", () => {
    expect(sanitizeFields(["account", "vkn", "account", "side"])).toEqual(["account", "side"]);
  });
});
