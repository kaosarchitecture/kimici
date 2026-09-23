import { describe, expect, it } from "vitest";
import {
  buildChatMessages,
  cfGrokId,
  DEFAULT_XAI_MODEL,
  documentContext,
  extractModelText,
  SYSTEM_PROMPT,
  xaiChatBody,
} from "../src/ai.ts";
import { documentFromFile } from "../src/ubl.ts";

describe("Grok prompt", () => {
  it("keeps the model off SQL", () => {
    expect(DEFAULT_XAI_MODEL).toBe("grok-4.20-0309-reasoning");
    expect(cfGrokId("grok-4.6")).toBe("xai/grok-4.6");
    expect(SYSTEM_PROMPT).toContain("Grok");
    expect(SYSTEM_PROMPT).toContain("SQL yazma");
    expect(SYSTEM_PROMPT).toContain("İND.KDV.");
    expect(SYSTEM_PROMPT).toContain("100 01");
  });

  it("sends uploaded fields, not invented books", () => {
    const xml = `<?xml version="1.0"?><Invoice><cbc:ID>A-1</cbc:ID><cbc:IssueDate>2026-01-02</cbc:IssueDate><cbc:Name>ABC</cbc:Name><cbc:TaxExclusiveAmount>10</cbc:TaxExclusiveAmount><cbc:TaxAmount>2</cbc:TaxAmount><cbc:PayableAmount>12</cbc:PayableAmount></Invoice>`;
    const doc = documentFromFile("a.xml", "application/xml", xml.length, xml);
    expect(documentContext(doc)).toContain("A-1");
    const messages = buildChatMessages("özet", doc);
    expect(xaiChatBody(messages, "grok-4.6").model).toBe("grok-4.6");
  });

  it("reads xAI chat and CF response shapes", () => {
    expect(extractModelText({ choices: [{ message: { content: "  merhaba  " } }] })).toBe("merhaba");
    expect(extractModelText({ result: { choices: [{ message: { content: "ok" } }] } })).toBe("ok");
    expect(extractModelText("")).toBe("");
  });
});
