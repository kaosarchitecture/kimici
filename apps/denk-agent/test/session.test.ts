import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";
import { handleHubMessage, type AgentRuntime } from "../src/session.ts";
import type { SqlPort } from "../src/eta-session.ts";

const pack = buildKnowledgePack();

function port(rows: Record<string, Record<string, unknown>[]>): SqlPort {
  return {
    async query(_server, database, statement) {
      if (statement.includes("INFORMATION_SCHEMA")) {
        const spec: Record<string, string[]> = {
          SIRKET: ["SIRKOD", "SIRDBNAME", "SIRPATH"],
          MUHFIS: ["MUHFISREFNO", "MUHFISNO", "MUHFISTAR", "MUHFISSEVNO", "MUHFISBELTUR", "MUHFISBORCTOP", "MUHFISALACAKTOP"],
          MUHHAR: ["MUHHARREFNO", "MUHHARSIRANO", "MUHHARMUHKOD", "MUHHARBATIPI", "MUHHARTUTAR", "MUHHARACIKLAMA", "MUHHARTAR"],
        };
        const found: Record<string, unknown>[] = [];
        for (const [table, cols] of Object.entries(spec)) {
          if (!rows[`${database}.${table}`]) continue;
          for (const columnName of cols) found.push({ tableName: table, columnName });
        }
        return found;
      }
      if (statement.includes("MUHHARSIRANO")) {
        return [
          {
            refNo: 10,
            seq: 1,
            account: "770 01",
            side: 1,
            amount: 100,
            description: "gider",
            lineDate: "2026-01-02",
          },
        ];
      }
      if (statement.includes("MUHFISSEVNO")) {
        return [
          {
            refNo: 10,
            voucherNo: "MA-000010",
            voucherDate: "2026-01-02",
            versionNo: 3,
            kind: "FAT",
            debit: 120,
            credit: 120,
          },
        ];
      }
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
      servers: ["localhost"],
      log: () => {},
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
    expect(done.outbound?.read?.vouchers[0]?.version).toBe("3");
    expect(done.outbound?.read?.vouchers[0]?.lines[0]?.account).toBe("770 01");
    expect(done.outbound?.read?.vouchers[0]?.lines[0]?.side).toBe("B");
    expect(done.outbound?.read?.files).toEqual(["muhfis.dat"]);
    expect(JSON.stringify(done.outbound)).not.toMatch(/Deneme|DENEME/);
    expect(done.outbound?.vouchers).toEqual([]);
    expect(done.outbound?.note).toContain("Build açık");
    const built = await done.runtime.build?.("ETA_S29_2026", plan);
    expect(built?.header.MUHFISNO).toBe("MA-000011");
    expect(built?.debitTotal).toBe(built?.creditTotal);
    await expect(done.runtime.build?.("ETA_OTHER_2026", plan)).rejects.toThrow(/açık değil/);
  });

  it("reads ETA V11 from ETA_MASTER", async () => {
    const runtime: AgentRuntime = { pack, machineId: "pc-a" };
    const done = await handleHubMessage(runtime, { type: "job.run", jobId: "job_1" }, {
      servers: ["localhost"],
      log: () => {},
      sql: port({
        "master.master": [{ name: "ETA_MASTER" }],
        "ETA_MASTER.SIRKET": [{ SIRKOD: "M01", SIRDBNAME: "ETA_M01_2026", SIRPATH: "C:\\ETA\\M01" }],
        "ETA_M01_2026.MUHFIS": [{ MUHFISREFNO: 8, MUHFISNO: "MA-000008", MUHFISISYKOD: "MERKEZ" }],
        "ETA_M01_2026.MUHHAR": [{ MUHHARREFNO: 8, MUHHARSIRANO: 1 }],
        "ETA_M01_2026.MUHFISIPTAL": [],
      }),
      listDir: async () => [],
    });
    expect(done.outbound?.read?.companies).toEqual(["M01"]);
    expect(done.outbound?.read?.databases).toEqual(["ETA_MASTER"]);
    expect(done.outbound?.status).toBe("done");
  });

  it("does not open build when SQL has no ETA", async () => {
    const runtime: AgentRuntime = { pack, machineId: "pc-a" };
    const done = await handleHubMessage(runtime, { type: "job.run", jobId: "job_1" }, {
      servers: ["localhost"],
      log: () => {},
      sql: port({ "master.master": [{ name: "other" }] }),
    });
    expect(done.outbound?.status).toBe("empty");
    expect(done.outbound?.eta?.build).toBe("closed");
    expect(done.runtime.build).toBeUndefined();
  });

  it("finds ETA tables without a fixed master name and sends that path to xAI", async () => {
    const runtime: AgentRuntime = { pack, machineId: "pc-a" };
    let facts = "";
    const done = await handleHubMessage(runtime, { type: "job.run", jobId: "job_1" }, {
      servers: ["10.0.0.8,1433"],
      log: () => {},
      sql: port({
        "master.master": [{ name: "OFIS" }],
        "OFIS.SIRKET": [{ SIRKOD: "A1", SIRDBNAME: "ETA_A1_2026", SIRPATH: "D:\\DATA\\A1" }],
        "ETA_A1_2026.MUHFIS": [{ MUHFISREFNO: 2, MUHFISNO: "MA-000002" }],
        "ETA_A1_2026.MUHHAR": [{ MUHHARREFNO: 2, MUHHARSIRANO: 1 }],
      }),
      model: async (text) => {
        facts = text;
        return "A1 fişi MA-999999 bu bilgisayarda.";
      },
    });
    expect(facts).toContain("sunucu=10.0.0.8,1433");
    expect(facts).toContain("A1");
    expect(facts).toContain("MA-000010");
    expect(facts).not.toMatch(/xai-/);
    expect(done.outbound?.read?.databases).toEqual(["OFIS"]);
    expect(done.outbound?.read?.companies).toEqual(["A1"]);
    expect(done.outbound?.read?.vouchers[0]?.voucherNo).toBe("MA-000010");
    expect(done.outbound?.modelNote).toBeUndefined();
    expect(done.outbound?.note).toContain("xAI bu bilgisayarda çağrıldı");
    expect(JSON.stringify(done.outbound)).not.toMatch(/MA-999999|Deneme|DENEME/);

    const kept = await handleHubMessage(runtime, { type: "job.run", jobId: "job_2" }, {
      servers: ["10.0.0.8,1433"],
      log: () => {},
      sql: port({
        "master.master": [{ name: "OFIS" }],
        "OFIS.SIRKET": [{ SIRKOD: "A1", SIRDBNAME: "ETA_A1_2026", SIRPATH: "" }],
        "ETA_A1_2026.MUHFIS": [{ MUHFISREFNO: 2 }],
        "ETA_A1_2026.MUHHAR": [{ MUHHARREFNO: 2 }],
      }),
      model: async () => "A1 fişi MA-000010 bu bilgisayarda.",
    });
    expect(kept.outbound?.modelNote).toBe("A1 fişi MA-000010 bu bilgisayarda.");
    expect(kept.outbound?.read?.vouchers.map((row) => row.voucherNo)).toEqual(["MA-000010"]);
  });
});
