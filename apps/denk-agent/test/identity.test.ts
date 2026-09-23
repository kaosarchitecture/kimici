import { describe, expect, it } from "vitest";
import { liveWindowsIdentityFromEnv } from "../src/identity.ts";

describe("live Windows identity", () => {
  it("returns null when the machine did not supply an account", () => {
    expect(liveWindowsIdentityFromEnv({})).toBeNull();
  });

  it("rejects DEMO stand-ins", () => {
    expect(() =>
      liveWindowsIdentityFromEnv({
        DENK_WINDOWS_ACCOUNT: "DEMO\\Kullanici",
        DENK_WINDOWS_SID: "S-1-5-21-DEMO-1001",
      }),
    ).toThrow(/DEMO/);
  });

  it("accepts a DOMAIN\\user + SID pair", () => {
    const identity = liveWindowsIdentityFromEnv({
      DENK_WINDOWS_ACCOUNT: "OFIS\\Muhasebe",
      DENK_WINDOWS_SID: "S-1-5-21-100-200-300-4400",
    });
    expect(identity?.account).toBe("OFIS\\Muhasebe");
    expect(identity?.interactive).toBe(true);
  });
});
