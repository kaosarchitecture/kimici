import type { AgentResultMessage } from "../../../packages/consent-view/src/desk.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import type { BuiltVoucher } from "../../../packages/eta-core/src/writer.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";
import { buildFromTemplate, etaNote, readMachine, type EtaAccess, type LocalRead, type SqlPort } from "./eta-session.ts";
import { listLocalDir } from "./local-dir.ts";
import { listLocalSqlServers, windowsSqlPort } from "./windows-sql.ts";

export interface AgentRuntime {
  pack: KnowledgePack | null;
  machineId: string;
  build?: (companyDb: string, plan: VoucherPlan) => Promise<BuiltVoucher>;
}

export interface HubMessage {
  type?: string;
  pack?: KnowledgePack;
  jobId?: string;
  error?: string;
}

export async function handleHubMessage(
  runtime: AgentRuntime,
  message: HubMessage,
  io: {
    sql?: SqlPort;
    listDir?: (dir: string) => Promise<string[]>;
    servers?: readonly string[];
    log?: (line: string) => void;
  } = {},
): Promise<{ runtime: AgentRuntime; outbound: AgentResultMessage | null }> {
  if (message.type === "rules" && message.pack?.version) {
    return { runtime: { ...runtime, pack: message.pack }, outbound: null };
  }
  if (message.type !== "job.run" || !message.jobId) {
    return { runtime, outbound: null };
  }
  if (!runtime.pack) {
    return { runtime, outbound: failed(runtime, message.jobId, "Kural paketi bu bağlantıda yok.") };
  }

  const port = io.sql ?? windowsSqlPort();
  let access: EtaAccess;
  let read: LocalRead;
  let server: string | null = null;
  let readyDatabases: string[] = [];
  try {
    const servers = io.servers ?? (await listLocalSqlServers());
    const found = await readMachine(port, io.listDir ?? listLocalDir, servers, io.log ?? ((line) => console.log(line)));
    access = { sql: found.sql, companies: found.companies, build: found.build };
    read = { databases: found.databases, companies: found.companies, vouchers: found.vouchers, files: found.files };
    server = found.server;
    readyDatabases = found.readyDatabases;
  } catch (error) {
    const note = error instanceof Error ? error.message : "Bu bilgisayarda SQL açılmadı.";
    return { runtime: { ...runtime, build: undefined }, outbound: failed(runtime, message.jobId, note) };
  }

  const next: AgentRuntime = {
    ...runtime,
    build:
      access.build === "open" && server
        ? (companyDb, plan) => {
            if (!readyDatabases.includes(companyDb)) {
              return Promise.reject(new Error("Build bu şirkette açık değil."));
            }
            return buildFromTemplate(port, server, companyDb, plan);
          }
        : undefined,
  };
  const status = access.sql && access.companies.length > 0 ? "done" : "empty";
  return {
    runtime: next,
    outbound: {
      type: "agent.result",
      jobId: message.jobId,
      machineId: runtime.machineId,
      status,
      note: etaNote({ ...access, ...read, server, readyDatabases }),
      vouchers: [],
      eta: access,
      read,
    },
  };
}

function failed(runtime: AgentRuntime, jobId: string, note: string): AgentResultMessage {
  return {
    type: "agent.result",
    jobId,
    machineId: runtime.machineId,
    status: "failed",
    note,
    vouchers: [],
    eta: { sql: false, companies: [], build: "closed" },
  };
}
