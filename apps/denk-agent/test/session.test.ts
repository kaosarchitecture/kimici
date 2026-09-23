import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";
import { handleHubMessage, type AgentRuntime } from "../src/session.ts";
import type { SqlPort } from "../src/eta-session.ts";

const pack = buildKnowledgePack();

function port(rows: Record<string, Record<string, unknown>[]>): SqlPort {
  return {
    async query(_server, database, statement) {
      if (statement.includes("AS refNo")) {
        if (statement.includes("MUHFISIPTAL")) return [{ refNo: 4 }];
        return [{ refNo: 10 }];
      }
      if (statement.includes("AS voucherNo")) {
        if (statement.includes("MUHFISIPTAL")) return [{ voucherNo: "MA-000004" }];
        return [{ voucherNo: "MA-000010" }];
      }
      const table = statement.includes("FROM MUHFISIPTAL")
        ? "MUHFISIPTAL"
        : statement.includes("FROM MUHHAR")
          ? "MUHHAR"
          : statement.includes("FROM MUHFIS")
            ? "MUHFIS"
            : statement.includes("FROM SIRKET")
              ? "SIRKET"
              : "master";
      return rows[`${database}.${table}`] ?? [];
    },
  };
}

const plan: VoucherPlan = {
  companyDb: "ETA_S29_2026",
  kind: "FAT",
  mode: "single-invoice",
  headerDate: "2026-01-02",
  lines: [
    {
      seq: 1,
      account: "770 01",
      side: "D",
      amount: 10000,
      description: "gider",
      docNo: "F-1",
      lineDate: "2026-01-02",
      docDate: "2026-01-02",
      ruleId: "test",
    },
    {
      seq: 2,
      account: "320 01",
      side: "C",
      amount: 10000,
      description: "cari",
      docNo: "F-1",
      lineDate: "2026-01-02",
      docDate: "2026-01-02",
      ruleId: "test",
    },
  ],
  blockers: [],
};

describe("hub messages", () => {
  it("opens ETA with the Windows session and leaves build usable on that machine", async () => {
    const runtime: AgentRuntime = { pack: null, machineId: "pc-a" };
    const withRules = await handleHubMessage(runtime, { type: "rules", pack });
    const done = await handleHubMessage(withRules.runtime, { type: "job.run", jobId: "job_1" }, {
      sql: port({
        "master.master": [{ name: "ETA_MASTERV8" }],
        "ETA_MASTERV8.SIRKET": [{ SIRKOD: "S29", SIRDBNAME: "ETA_S29_2026", SIRPATH: "C:\\ETA\\S29" }],
        "ETA_S29_2026.MUHFIS": [{ MUHFISREFNO: 10, MUHFISNO: "MA-000010", MUHFISISYKOD: "MERKEZ" }],
        "ETA_S29_2026.MUHHAR": [{ MUHHARREFNO: 10, MUHHARSIRANO: 1, MUHHARMUHKOD: "100 01" }],
        "ETA_S29_2026.MUHFISIPTAL": [{ MUHFISREFNO: 4, MUHFISNO: "MA-000004" }],
      }),
      listDir: async () => ["muhfis.dat"],
    });
    expect(done.outbound?.eta).toEqual({ sql: true, companies: ["S29"], build: "open" });
    expect(done.outbound?.read?.databases).toEqual(["ETA_MASTERV8"]);
    expect(done.outbound?.read?.vouchers[0]?.voucherNo).toBe("MA-000010");
    expect(done.outbound?.read?.files).toEqual(["muhfis.dat"]);
    expect(JSON.stringify(done.outbound)).not.toMatch(/Deneme|DENEME/);
    expect(done.outbound?.vouchers).toEqual([]);
    expect(done.outbound?.note).toContain("Build açık");
    const built = await done.runtime.build?.("ETA_S29_2026", plan);
    expect(built?.header.MUHFISNO).toBe("MA-000011");
    expect(built?.debitTotal).toBe(built?.creditTotal);
    await expect(done.runtime.build?.("ETA_OTHER_2026", plan)).rejects.toThrow(/açık değil/);
  });

  it("does not open build when SQL has no ETA", async () => {
    const runtime: AgentRuntime = { pack, machineId: "pc-a" };
    const done = await handleHubMessage(runtime, { type: "job.run", jobId: "job_1" }, {
      sql: port({ "master.master": [{ name: "other" }] }),
    });
    expect(done.outbound?.status).toBe("empty");
    expect(done.outbound?.eta?.build).toBe("closed");
    expect(done.runtime.build).toBeUndefined();
  });
});
