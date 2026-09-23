import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { handleHubMessage, type AgentRuntime } from "../src/session.ts";

const pack = buildKnowledgePack();

describe("hub messages", () => {
  it("runs the job on this computer after the rule pack arrives", async () => {
    const runtime: AgentRuntime = { pack: null, machineId: "pc-a", localDir: "/tmp/nowhere" };
    const withRules = await handleHubMessage(runtime, { type: "rules", pack });
    const sent: unknown[] = [];
    const done = await handleHubMessage(withRules.runtime, { type: "job.run", jobId: "job_1" }, {
      runInbox: async () => ({
        status: "done",
        note: "1 kayıt bu bilgisayarda işlendi.",
        vouchers: [
          {
            sourceName: "islem.log",
            sourceKind: "log",
            invoiceNo: "LOG-1",
            date: "2026-02-01",
            supplierName: "Deneme",
            debit: "60,00",
            credit: "60,00",
            preview: "İND.KDV.",
            blockers: [],
            lines: [],
          },
        ],
      }),
      narrate: async () => "Bu makinede değerlendirme.",
    });
    if (done.outbound) sent.push(done.outbound);
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).toContain("LOG-1");
    expect(JSON.stringify(sent[0])).toContain("Bu makinede değerlendirme.");
    expect(JSON.stringify(sent[0])).not.toMatch(/select |insert |xai-/i);
  });
});
