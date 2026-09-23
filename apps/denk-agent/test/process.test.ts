import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { processLocalEvrak } from "../src/process.ts";

const XML = `<?xml version="1.0"?><Invoice><cbc:ID>A-1</cbc:ID><cbc:IssueDate>2026-01-02</cbc:IssueDate><cbc:Name>ABC</cbc:Name><cbc:TaxExclusiveAmount>100</cbc:TaxExclusiveAmount><cbc:TaxAmount>20</cbc:TaxAmount><cbc:PayableAmount>120</cbc:PayableAmount></Invoice>`;

describe("edge agent", () => {
  it("builds the voucher on this machine from hub knowledge", () => {
    const result = processLocalEvrak("a.xml", "application/xml", XML, buildKnowledgePack());
    expect(result.document.invoiceNo).toBe("A-1");
    expect(result.preview).toContain("İND.KDV.");
    expect(result.preview).toContain("100 01");
    expect(result.blockers).toEqual([]);
    expect(result.records.some((row) => row.description === "İND.KDV.")).toBe(true);
    expect(result.records.some((row) => row.account === "100 01")).toBe(true);
    expect(JSON.stringify(result.records)).not.toContain("A-1");
    expect(result.records.every((row) => !("invoiceNo" in row))).toBe(true);
  });
});
