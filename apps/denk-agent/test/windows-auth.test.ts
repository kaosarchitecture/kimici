import { describe, expect, it } from "vitest";
import { authorizeWindowsSession, WindowsAuthError } from "../src/windows-auth.ts";

const NOW = new Date("2026-09-23T12:00:00.000Z");

describe("Windows session approval", () => {
  it("returns the interactive account only after the user allows it", async () => {
    const identity = await authorizeWindowsSession(
      async () => ({ account: "OFIS\\Muhasebe", sid: "S-1-5-21-1001", interactive: true }),
      async () => true,
      NOW,
    );
    expect(identity.account).toBe("OFIS\\Muhasebe");
    expect(identity.interactive).toBe(true);
    expect(JSON.stringify(identity)).not.toMatch(/password|parola/i);
  });

  it("stops when the Windows user refuses", async () => {
    await expect(
      authorizeWindowsSession(
        async () => ({ account: "OFIS\\Muhasebe", sid: "S-1-5-21-1001", interactive: true }),
        async () => false,
        NOW,
      ),
    ).rejects.toBeInstanceOf(WindowsAuthError);
  });

  it("stops outside an interactive Windows session", async () => {
    await expect(
      authorizeWindowsSession(
        async () => ({ account: "OFIS\\Muhasebe", sid: "S-1-5-21-1001", interactive: false }),
        async () => true,
        NOW,
      ),
    ).rejects.toThrow(/etkileşimli/);
  });
});
