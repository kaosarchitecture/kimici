import { describe, expect, it } from "vitest";
import { formatTr, kurusToDecimalString, parseTrAmount, percentOf, tlToKurus } from "../src/money.ts";

describe("parseTrAmount (Kural 12)", () => {
  it("reads the approved statement examples as TL, not kuruş", () => {
    expect(parseTrAmount("30.150,00")).toBe(3_015_000);
    expect(parseTrAmount("-964,62")).toBe(-96_462);
    expect(parseTrAmount("-10.000,00")).toBe(-1_000_000);
    expect(parseTrAmount("-5.981,00")).toBe(-598_100);
    expect(parseTrAmount("-3.000,00")).toBe(-300_000);
    expect(parseTrAmount("-8,37")).toBe(-837);
    expect(parseTrAmount("27.900,00")).toBe(2_790_000);
    expect(parseTrAmount("-741,71")).toBe(-74_171);
  });

  it("rejects the 100x strip-all-separators mistake", () => {
    expect(parseTrAmount("30.150,00")).not.toBe(301_500_000);
    expect(() => parseTrAmount("30.150.00")).toThrow(/tanınmadı/);
    expect(() => parseTrAmount("")).toThrow(/boş/);
  });

  it("accepts Excel Value2 doubles in TL", () => {
    expect(tlToKurus(30150)).toBe(3_015_000);
    expect(tlToKurus(-8.37)).toBe(-837);
    expect(tlToKurus(0.1 + 0.2)).toBe(30);
  });
});

describe("percentOf and display", () => {
  it("matches the approved passenger-car invoice to the kuruş", () => {
    expect(percentOf(5_070_911, 70)).toBe(3_549_638);
    expect(percentOf(1_014_183, 70)).toBe(709_928);
    expect(percentOf(6_085_094, 30)).toBe(1_825_528);
  });

  it("formats ETA-style decimals and reports", () => {
    expect(kurusToDecimalString(7_910_622)).toBe("79106.22");
    expect(formatTr(7_910_622)).toBe("79.106,22");
    expect(formatTr(-837)).toBe("-8,37");
  });
});
