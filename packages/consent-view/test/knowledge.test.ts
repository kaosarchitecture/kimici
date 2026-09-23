import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../src/knowledge.ts";

describe("knowledge pack", () => {
  it("ships rules, not customer books", () => {
    const pack = buildKnowledgePack();
    expect(pack.vatDescription).toBe("İND.KDV.");
    expect(pack.cashAccount).toBe("100 01");
    expect(pack.nftPurchase).toBe("N.FT İLE ALIŞ");
    expect(pack.prompt.toLocaleLowerCase("tr-TR")).not.toContain("sql");
    expect(JSON.stringify(pack)).not.toMatch(/xai-/i);
  });
});
