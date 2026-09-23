import type { AgentResultMessage } from "../../../packages/consent-view/src/desk.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import type { BuiltVoucher } from "../../../packages/eta-core/src/writer.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";
import { buildFromTemplate, etaNote, pathFacts, readMachine, type EtaAccess, type LocalRead, type SqlPort } from "./eta-session.ts";
import { listLocalDir } from "./local-dir.ts";
import { acceptModelNote, localModelNote } from "./local-model.ts";
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
    model?: (facts: string) => Promise<string | null>;
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
  const log = io.log ?? ((line: string) => console.log(line));
  let access: EtaAccess;
  let read: LocalRead;
  let server: string | null = null;
  let readyDatabases: string[] = [];
  let facts = "";
  try {
    log("Bu bilgisayarda SQL ve ETA aranıyor.");
    const servers = io.servers ?? (await listLocalSqlServers());
    const found = await readMachine(port, io.listDir ?? listLocalDir, servers, log);
    access = { sql: found.sql, companies: found.companies, build: found.build };
    read = { databases: found.databases, companies: found.companies, vouchers: found.vouchers, files: found.files };
    server = found.server;
    readyDatabases = found.readyDatabases;
    facts = pathFacts(found);
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
  let note = etaNote({ ...access, ...read, server, readyDatabases });
  let modelNote: string | undefined;
  try {
    const asked = io.model
      ? { called: true, text: await io.model(facts) }
      : await localModelNote(runtime.pack, facts, { log });
    const accepted = asked.text ? acceptModelNote(asked.text, facts) : null;
    if (accepted) modelNote = accepted;
    else if (asked.called && asked.text) log("xAI cevabı okunan kayda uymadı.");
    if (asked.called && !modelNote) note = `${note} xAI bu bilgisayarda çağrıldı.`;
  } catch {
    log("xAI cevap vermedi.");
  }
  return {
    runtime: next,
    outbound: {
      type: "agent.result",
      jobId: message.jobId,
      machineId: runtime.machineId,
      status,
      note: note.slice(0, 500),
      modelNote,
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
