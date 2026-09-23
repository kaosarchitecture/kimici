import { describe, expect, it } from "vitest";
import {
  buildChatMessages,
  CF_GROK_MODEL,
  documentContext,
  extractModelText,
  SYSTEM_PROMPT,
  XAI_MODEL,
  xaiChatBody,
} from "../src/ai.ts";
import { documentFromFile } from "../src/ubl.ts";

describe("Grok 4.5 prompt", () => {
  it("names Grok 4.5 and keeps the model off SQL", () => {
    expect(XAI_MODEL).toBe("grok-4.5");
    expect(CF_GROK_MODEL).toBe("xai/grok-4.5");
    expect(SYSTEM_PROMPT).toContain("Grok 4.5");
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
    expect(xaiChatBody(messages).model).toBe("grok-4.5");
  });

  it("reads xAI chat and CF response shapes", () => {
    expect(extractModelText({ choices: [{ message: { content: "  merhaba  " } }] })).toBe("merhaba");
    expect(extractModelText({ result: { choices: [{ message: { content: "ok" } }] } })).toBe("ok");
    expect(extractModelText({ response: "eski" })).toBe("eski");
    expect(extractModelText("")).toBe("");
  });
});
