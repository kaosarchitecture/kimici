import { describe, expect, it } from "vitest";
import { parseTenantId, tenantFromRequest } from "../src/tenant.ts";

describe("tenant id", () => {
  it("accepts lowercase hyphenated codes", () => {
    expect(parseTenantId("Ofis-12")).toBe("ofis-12");
  });

  it("rejects empty, short, and illegal characters", () => {
    expect(() => parseTenantId("")).toThrow(/geçersiz/);
    expect(() => parseTenantId("a")).toThrow(/geçersiz/);
    expect(() => parseTenantId("Office_1")).toThrow(/geçersiz/);
  });

  it("reads X-Denk-Tenant before the query string", () => {
    const request = new Request("https://hub.example/api/state?tenant=query-id", {
      headers: { "X-Denk-Tenant": "header-id" },
    });
    expect(tenantFromRequest(request)).toBe("header-id");
  });
});
