import { describe, expect, it } from "vitest";
import { isSqlServerName, localConnectionString } from "../src/eta-session.ts";
import { sqlTargetsFromNames } from "../src/windows-sql.ts";

describe("Windows SQL connection", () => {
  it("uses integrated security and refuses a password", () => {
    const connectionString = localConnectionString("localhost", "ETA_MASTERV8");
    expect(connectionString).toContain("Integrated Security=True");
    expect(connectionString).not.toMatch(/password|user id/i);
    expect(localConnectionString("10.0.0.8,1433", "master")).toContain("Server=10.0.0.8,1433");
    expect(localConnectionString(".\\SQLEXPRESS", "master")).toContain("Server=.\\SQLEXPRESS");
    expect(() => localConnectionString("localhost;Password=secret", "master")).toThrow(/geçersiz/);
    expect(isSqlServerName("(local)")).toBe(true);
    expect(isSqlServerName("tcp:sql.local,1433")).toBe(true);
  });

  it("keeps ODBC server names and drops anything that could add a password", () => {
    expect(sqlTargetsFromNames([" 10.1.1.5, 1433 ", "localhost", "localhost", "bad;Password=x", ".\\ETA"])).toEqual([
      "10.1.1.5,1433",
      "localhost",
      ".\\ETA",
    ]);
  });
});
