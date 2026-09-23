import { describe, expect, it } from "vitest";
import { localConnectionString } from "../src/eta-session.ts";

describe("Windows SQL connection", () => {
  it("uses integrated security and refuses a password", () => {
    const connectionString = localConnectionString("localhost", "ETA_MASTERV8");
    expect(connectionString).toContain("Integrated Security=True");
    expect(connectionString).not.toMatch(/password|user id/i);
    expect(() => localConnectionString("localhost;Password=secret", "master")).toThrow(/geçersiz/);
  });
});
