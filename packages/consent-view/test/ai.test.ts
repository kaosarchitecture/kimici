import { describe, expect, it } from "vitest";
import { buildChatMessages, documentContext, extractModelText, SYSTEM_PROMPT } from "../src/ai.ts";
import { documentFromFile } from "../src/ubl.ts";

describe("Workers AI prompt", () => {
  it("keeps the model on our server and off SQL", () => {
    expect(SYSTEM_PROMPT).toContain("Cloudflare Worker");
    expect(SYSTEM_PROMPT).toContain("SQL yazma");
    expect(SYSTEM_PROMPT).toContain("İND.KDV.");
    expect(SYSTEM_PROMPT).toContain("100 01");
  });

  it("sends uploaded fields, not invented books", () => {
    const xml = `<?xml version="1.0"?><Invoice><cbc:ID>A-1</cbc:ID><cbc:IssueDate>2026-01-02</cbc:IssueDate><cbc:Name>ABC</cbc:Name><cbc:TaxExclusiveAmount>10</cbc:TaxExclusiveAmount><cbc:TaxAmount>2</cbc:TaxAmount><cbc:PayableAmount>12</cbc:PayableAmount></Invoice>`;
    const doc = documentFromFile("a.xml", "application/xml", xml.length, xml);
    const ctx = documentContext(doc);
    expect(ctx).toContain("A-1");
    expect(ctx).toContain("ABC");
    const messages = buildChatMessages("özet", doc);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.content).toContain("Kullanıcı: özet");
    expect(messages[1]?.content).toContain("A-1");
  });

  it("reads Workers AI response shape", () => {
    expect(extractModelText({ response: "  merhaba  " })).toBe("merhaba");
    expect(extractModelText({ result: { response: "ok" } })).toBe("ok");
    expect(extractModelText("")).toBe("");
  });
});
