import { describe, expect, it } from "vitest";
import { buildKnowledgePack } from "../src/knowledge.ts";
import {
  emptyDesk,
  onDisconnect,
  onHello,
  onResult,
  onRun,
  publicSnapshot,
  type AgentResultMessage,
  type DeskVoucher,
} from "../src/desk.ts";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const pack = buildKnowledgePack();

function voucher(invoiceNo: string): DeskVoucher {
  return {
    sourceName: "audit.json",
    sourceKind: "audit",
    invoiceNo,
    date: "2026-01-02",
    supplierName: "Ornek",
    debit: "120,00",
    credit: "120,00",
    preview: "İND.KDV.",
    blockers: [],
    lines: [{ seq: 1, account: "191 02 20", side: "B", amountText: "20,00", description: "İND.KDV.", date: "2026-01-02" }],
  };
}

describe("connected computers", () => {
  it("sends rules to the computer that connected and starts work only there", () => {
    const first = onHello(emptyDesk(), { type: "agent.hello", machineId: "pc-a", hostname: "PC-A" }, NOW, pack);
    const second = onHello(first.state, { type: "agent.hello", machineId: "pc-b", hostname: "PC-B" }, NOW, pack);

    expect(first.toAgent[0]).toEqual({ type: "rules", pack });
    expect(first.toAgent[1]).toEqual({ type: "job.run", jobId: first.job.jobId });
    expect(JSON.stringify(first.toAgent[1])).not.toMatch(/select|sql|path|xml/i);
    expect(first.job.machineId).toBe("pc-a");
    expect(second.job.machineId).toBe("pc-b");
    expect(second.state.lastByMachine["pc-a"]).toBe(first.job.jobId);
    expect(second.state.lastByMachine["pc-b"]).toBe(second.job.jobId);
  });

  it("keeps one computer's voucher off the other computer", () => {
    const hello = onHello(emptyDesk(), { type: "agent.hello", machineId: "pc-a", hostname: "PC-A" }, NOW, pack);
    const other = onHello(hello.state, { type: "agent.hello", machineId: "pc-b", hostname: "PC-B" }, NOW, pack);
    const done = onResult(other.state, {
      type: "agent.result",
      jobId: hello.job.jobId,
      machineId: "pc-a",
      status: "done",
      note: "1 kayıt bu bilgisayarda işlendi.",
      vouchers: [voucher("A-1")],
    }, NOW);

    expect(done.jobs[hello.job.jobId]?.vouchers[0]?.invoiceNo).toBe("A-1");
    expect(done.jobs[other.job.jobId]?.vouchers).toEqual([]);
    expect(done.lastByMachine["pc-b"]).toBe(other.job.jobId);
  });

  it("rejects a result claimed by the wrong computer", () => {
    const hello = onHello(emptyDesk(), { type: "agent.hello", machineId: "pc-a", hostname: "PC-A" }, NOW, pack);
    const foreign: AgentResultMessage = {
      type: "agent.result",
      jobId: hello.job.jobId,
      machineId: "pc-b",
      status: "done",
      note: "yok",
      vouchers: [],
    };
    expect(() => onResult(hello.state, foreign, NOW)).toThrow(/bu bilgisayara ait değil/);
  });

  it("does not start work on a computer that is offline", () => {
    expect(() => onRun(emptyDesk(), "pc-a", "PC-A", false, NOW)).toThrow(/bağlı değil/);
  });

  it("marks a running job dropped when that computer leaves", () => {
    const hello = onHello(emptyDesk(), { type: "agent.hello", machineId: "pc-a", hostname: "PC-A" }, NOW, pack);
    const left = onDisconnect(hello.state, "pc-a", NOW);
    expect(left.jobs[hello.job.jobId]?.status).toBe("dropped");
  });

  it("publishes rules and presence without the rule prompt or a ledger", () => {
    const hello = onHello(emptyDesk(), { type: "agent.hello", machineId: "pc-a", hostname: "PC-A" }, NOW, pack);
    const view = publicSnapshot(hello.state, [{ machineId: "pc-a", hostname: "PC-A", connectedAt: NOW.toISOString() }], pack);
    expect(view.rulesVersion).toBe(pack.version);
    expect(view.vatDescription).toBe("İND.KDV.");
    expect(view.machines[0]?.online).toBe(true);
    expect(JSON.stringify(view)).not.toContain(pack.prompt);
    expect(JSON.stringify(view)).not.toMatch(/<Invoice|VKN|password/i);
  });
});
