import { describe, expect, it } from "vitest";
import { approvalPageUrl, newApprovalCode } from "../src/approve-page.ts";

describe("browser approval", () => {
  it("puts the one-time code in the hash, not the request query", () => {
    const code = newApprovalCode();
    const page = approvalPageUrl("https://app.denkmuhasebe.com", "DESKTOP-1", code);
    const url = new URL(page);
    expect(url.search).toBe("");
    expect(url.hash).toContain(`onay=${encodeURIComponent(code)}`);
    expect(url.hash).toContain("makine=DESKTOP-1");
    expect(page).not.toMatch(/password|ssh-ed25519/i);
    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });
});
