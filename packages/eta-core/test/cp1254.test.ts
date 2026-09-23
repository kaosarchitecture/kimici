import { describe, expect, it } from "vitest";
import { cp1254Hex, decodeCp1254, encodeCp1254, isCp1254Safe } from "../src/cp1254.ts";

describe("Windows-1254 (Kural 19)", () => {
  it("encodes the approved invoice texts as the live hex dumps", () => {
    expect(cp1254Hex("N.FT İLE ALIŞ")).toBe("4E2E465420DD4C4520414C49DE");
    expect(cp1254Hex("İND.KDV.")).toBe("DD4E442E4B44562E");
    expect(cp1254Hex("K.K.E.GİDERLER")).toBe("4B2E4B2E452E47DD4445524C4552");
    expect(cp1254Hex("ALIM FATURASI")).toBe("414C494D204641545552415349");
    expect(cp1254Hex("(320 A=014)")).toBe("2833323020413D30313429");
    expect(cp1254Hex("ARAÇ BAKIM ONARIM")).toBe("415241C72042414B494D204F4E4152494D");
  });

  it("rejects UTF-8 double bytes (the Ä° / Åž failure)", () => {
    const utf8I = Buffer.from("İ", "utf8");
    expect(utf8I.toString("hex")).toBe("c4b0");
    expect(encodeCp1254("İ").toString("hex")).toBe("dd");
    expect(decodeCp1254(encodeCp1254("N.FT İLE SATIŞ"))).toBe("N.FT İLE SATIŞ");
    expect(isCp1254Safe("N.FT İLE SATIŞ")).toBe(true);
    expect(isCp1254Safe("emoji 😀")).toBe(false);
  });
});
