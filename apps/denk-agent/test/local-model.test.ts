import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { acceptModelNote, localModelNote } from "../src/local-model.ts";

const pack = buildKnowledgePack();
const facts = "sunucu=10.0.0.8,1433\nveritabanı=OFIS\nşirket=A1\nfiş=MA-000010 A1 sürüm 3\nbuild=açık";

describe("xAI on the connected computer", () => {
  it("calls the API with the local key and does not put the key in the prompt", async () => {
    let seenKey = "";
    let seenUser = "";
    const result = await localModelNote(pack, facts, {
      readText: async () => "XAI_API_KEY=xai-test\nXAI_MODEL=grok-4.20-0309-reasoning\n",
      chat: async (key, messages, model) => {
        seenKey = key;
        seenUser = messages[1]?.content ?? "";
        expect(model).toBe("grok-4.20-0309-reasoning");
        expect(messages[0]?.content).not.toMatch(/770|İND\.KDV/);
        return "A1 fişi MA-000010 bu bilgisayarda.";
      },
      log: () => {},
    });
    expect(seenKey).toBe("xai-test");
    expect(seenUser).toContain("A1");
    expect(seenUser).not.toContain("xai-test");
    expect(result.called).toBe(true);
    expect(acceptModelNote(result.text ?? "", facts)).toBe("A1 fişi MA-000010 bu bilgisayarda.");
  });

  it("drops a reply that invents a voucher or a company", () => {
    expect(acceptModelNote("A1 fişi MA-999999 bu bilgisayarda.", facts)).toBeNull();
    expect(acceptModelNote("Deneme fişi açıldı.", facts)).toBeNull();
    expect(acceptModelNote("SQL açıldı. Şirket A1.", facts)).toBe("SQL açıldı. Şirket A1.");
  });

  it("stays quiet when this computer has no key", async () => {
    const result = await localModelNote(pack, facts, {
      readText: async () => "XAI_MODEL=grok-4.20-0309-reasoning\n",
      chat: async () => {
        throw new Error("anahtar yokken çağrılmamalı");
      },
      log: () => {},
    });
    expect(result).toEqual({ called: false, text: null });
  });
});
