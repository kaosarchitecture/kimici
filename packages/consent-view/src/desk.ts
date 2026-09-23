import type { KnowledgePack } from "./knowledge.ts";
import type { WindowsIdentity } from "./types.ts";
import { attestWindowsIdentity } from "./windows.ts";

/** One planned voucher produced on the connected computer. Source files stay there. */
export interface DeskLine {
  seq: number;
  account: string;
  side: "B" | "A";
  amountText: string;
  description: string;
  date: string;
}

export interface DeskVoucher {
  sourceName: string;
  sourceKind: "xml" | "audit" | "log";
  invoiceNo: string;
  date: string;
  supplierName: string;
  debit: string;
  credit: string;
  preview: string;
  blockers: string[];
  lines: DeskLine[];
}

export type JobStatus = "running" | "done" | "empty" | "blocked" | "dropped" | "failed";

export interface JobRecord {
  jobId: string;
  machineId: string;
  hostname: string;
  status: JobStatus;
  startedAt: string;
  finishedAt?: string;
  note: string;
  vouchers: DeskVoucher[];
  modelNote?: string;
  windowsAccount?: string;
  eta?: EtaAccess;
  read?: LocalRead;
}

export interface DeskState {
  jobs: Record<string, JobRecord>;
  lastByMachine: Record<string, string>;
}

export interface AgentHello {
  type: "agent.hello";
  machineId: string;
  hostname: string;
  windows: WindowsIdentity;
}

export interface EtaAccess {
  sql: boolean;
  companies: string[];
  build: "open" | "closed";
}

export interface ReadVoucher {
  company: string;
  voucherNo: string;
  date: string;
  debit: string;
  credit: string;
}

export interface LocalRead {
  databases: string[];
  companies: string[];
  vouchers: ReadVoucher[];
  files: string[];
}

export interface AgentResultMessage {
  type: "agent.result";
  jobId: string;
  machineId: string;
  status: "done" | "empty" | "blocked" | "failed";
  note: string;
  vouchers: DeskVoucher[];
  modelNote?: string;
  eta?: EtaAccess;
  read?: LocalRead;
}

export type HubToAgent = { type: "rules"; pack: KnowledgePack } | { type: "job.run"; jobId: string };

export interface OnlineMachine {
  machineId: string;
  hostname: string;
  connectedAt: string;
}

export interface MachineView {
  machineId: string;
  hostname: string;
  online: boolean;
  connectedAt: string | null;
  lastJob: JobRecord | null;
}

export interface DeskSnapshot {
  type: "snapshot";
  rulesVersion: string;
  vatDescription: string;
  cashAccount: string;
  vatAccount: string;
  expenseAccount: string;
  where: string;
  machines: MachineView[];
}

export const DESK_WHERE =
  "Kurallar bu sunucuda. SQL ve ETA varsa bağlanan bilgisayar kendi Windows oturumuyla girer. Build o makinede açılır.";

const MAX_JOBS = 40;
const MACHINE_ID = /^[\p{L}\p{N}_.:-]{1,80}$/u;
const RESULT_STATUS = new Set<AgentResultMessage["status"]>(["done", "empty", "blocked", "failed"]);

export function emptyDesk(): DeskState {
  return { jobs: {}, lastByMachine: {} };
}

export function assertMachineId(id: string): string {
  const trimmed = id.trim();
  if (!MACHINE_ID.test(trimmed)) throw new Error("Bilgisayar kimliği geçersiz.");
  return trimmed;
}

function remember(state: DeskState, job: JobRecord): DeskState {
  const jobs = { ...state.jobs, [job.jobId]: job };
  const ordered = Object.values(jobs).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const keep = new Set(ordered.slice(0, MAX_JOBS).map((row) => row.jobId));
  const trimmed: Record<string, JobRecord> = {};
  for (const row of ordered) {
    if (keep.has(row.jobId)) trimmed[row.jobId] = row;
  }
  const lastByMachine: Record<string, string> = {};
  for (const [machineId, jobId] of Object.entries({ ...state.lastByMachine, [job.machineId]: job.jobId })) {
    if (trimmed[jobId]) lastByMachine[machineId] = jobId;
  }
  return { jobs: trimmed, lastByMachine };
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanRead(input: LocalRead | undefined): LocalRead | undefined {
  if (!input) return undefined;
  const databases = (input.databases ?? []).map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 40);
  const companies = (input.companies ?? []).map((item) => cleanText(item, 40)).filter(Boolean).slice(0, 40);
  const files = (input.files ?? []).map((item) => cleanText(item, 120)).filter(Boolean).slice(0, 20);
  const vouchers = (input.vouchers ?? []).slice(0, 20).map((row) => ({
    company: cleanText(row.company, 40),
    voucherNo: cleanText(row.voucherNo, 40),
    date: cleanText(row.date, 40),
    debit: cleanText(row.debit, 40),
    credit: cleanText(row.credit, 40),
  }));
  return { databases, companies, files, vouchers };
}

function cleanEta(input: EtaAccess | undefined): EtaAccess | undefined {
  if (!input) return undefined;
  const companies = (input.companies ?? [])
    .map((code) => String(code).trim())
    .filter((code) => /^[\p{L}\p{N}_.-]{1,40}$/u.test(code))
    .slice(0, 40);
  const sql = input.sql === true;
  return {
    sql,
    companies,
    build: input.build === "open" && sql && companies.length > 0 ? "open" : "closed",
  };
}

function jobOf(state: DeskState, jobId: string | undefined): JobRecord | null {
  if (!jobId) return null;
  return state.jobs[jobId] ?? null;
}

function requireWindows(identity: WindowsIdentity | undefined): WindowsIdentity {
  if (!identity) throw new Error("Windows onayı yok.");
  const attested = attestWindowsIdentity(identity);
  if (/^DEMO\\/i.test(attested.account) || attested.sid.toUpperCase().includes("DEMO")) {
    throw new Error("Windows kimliği sahte.");
  }
  return attested;
}

export function onHello(
  state: DeskState,
  hello: AgentHello,
  now: Date,
  pack: KnowledgePack,
): { state: DeskState; toAgent: HubToAgent[]; job: JobRecord } {
  const machineId = assertMachineId(hello.machineId);
  const hostname = hello.hostname.trim().slice(0, 80) || machineId;
  const windows = requireWindows(hello.windows);
  const job: JobRecord = {
    jobId: `job_${crypto.randomUUID()}`,
    machineId,
    hostname,
    status: "running",
    startedAt: now.toISOString(),
    note: `${windows.account} onayıyla bu bilgisayarda işlem başlıyor.`,
    vouchers: [],
    windowsAccount: windows.account,
  };
  return {
    state: remember(state, job),
    job,
    toAgent: [
      { type: "rules", pack },
      { type: "job.run", jobId: job.jobId },
    ],
  };
}

export function onRun(state: DeskState, machineIdRaw: string, hostname: string, online: boolean, now: Date): {
  state: DeskState;
  job: JobRecord;
} {
  const machineId = assertMachineId(machineIdRaw);
  if (!online) throw new Error("Bu bilgisayar bağlı değil.");
  const previous = jobOf(state, state.lastByMachine[machineId]);
  if (!previous?.windowsAccount) throw new Error("Windows onayı yok.");
  const job: JobRecord = {
    jobId: `job_${crypto.randomUUID()}`,
    machineId,
    hostname: hostname.trim().slice(0, 80) || machineId,
    status: "running",
    startedAt: now.toISOString(),
    note: "Yeniden işleme bu bilgisayarda başladı.",
    vouchers: [],
    windowsAccount: previous.windowsAccount,
  };
  return { state: remember(state, job), job };
}

function cleanLine(input: DeskLine): DeskLine {
  const side = input.side === "A" || input.side === "B" ? input.side : "B";
  return {
    seq: Number.isFinite(input.seq) ? input.seq : 0,
    account: String(input.account ?? "").slice(0, 40),
    side,
    amountText: String(input.amountText ?? "").slice(0, 40),
    description: String(input.description ?? "").slice(0, 200),
    date: String(input.date ?? "").slice(0, 40),
  };
}

function cleanVoucher(input: DeskVoucher): DeskVoucher {
  const kind = input.sourceKind === "audit" || input.sourceKind === "log" ? input.sourceKind : "xml";
  return {
    sourceName: String(input.sourceName ?? "").slice(0, 200),
    sourceKind: kind,
    invoiceNo: String(input.invoiceNo ?? "").slice(0, 80),
    date: String(input.date ?? "").slice(0, 40),
    supplierName: String(input.supplierName ?? "").slice(0, 200),
    debit: String(input.debit ?? "").slice(0, 40),
    credit: String(input.credit ?? "").slice(0, 40),
    preview: String(input.preview ?? "").slice(0, 4000),
    blockers: (input.blockers ?? []).slice(0, 12).map((item) => String(item).slice(0, 300)),
    lines: (input.lines ?? []).slice(0, 40).map((line) => cleanLine(line)),
  };
}

export function onResult(state: DeskState, message: AgentResultMessage, now: Date): DeskState {
  const machineId = assertMachineId(message.machineId);
  if (!RESULT_STATUS.has(message.status)) throw new Error("İş durumu geçersiz.");
  const existing = state.jobs[message.jobId];
  if (existing && existing.machineId !== machineId) throw new Error("İş bu bilgisayara ait değil.");
  const job: JobRecord = {
    jobId: message.jobId,
    machineId,
    hostname: existing?.hostname || machineId,
    status: message.status,
    startedAt: existing?.startedAt || now.toISOString(),
    finishedAt: now.toISOString(),
    note: String(message.note ?? "").slice(0, 500),
    vouchers: [],
    windowsAccount: existing?.windowsAccount,
    eta: cleanEta(message.eta) ?? existing?.eta,
    read: cleanRead(message.read) ?? existing?.read,
  };
  if (message.modelNote?.trim()) job.modelNote = message.modelNote.trim().slice(0, 2000);
  return remember(state, job);
}

export function onDisconnect(state: DeskState, machineId: string, now: Date): DeskState {
  const jobs = { ...state.jobs };
  for (const job of Object.values(jobs)) {
    if (job.machineId === machineId && job.status === "running") {
      jobs[job.jobId] = {
        ...job,
        status: "dropped",
        finishedAt: now.toISOString(),
        note: "Bilgisayar bağlantısı koptu. İşlem o makinede tamamlanmadı.",
      };
    }
  }
  return { ...state, jobs };
}

export function machineViews(state: DeskState, online: readonly OnlineMachine[]): MachineView[] {
  const byId = new Map<string, MachineView>();
  for (const row of online) {
    const last = jobOf(state, state.lastByMachine[row.machineId]);
    byId.set(row.machineId, {
      machineId: row.machineId,
      hostname: row.hostname,
      online: true,
      connectedAt: row.connectedAt,
      lastJob: last,
    });
  }
  for (const [machineId, jobId] of Object.entries(state.lastByMachine)) {
    if (byId.has(machineId)) continue;
    const last = jobOf(state, jobId);
    if (!last) continue;
    byId.set(machineId, {
      machineId,
      hostname: last.hostname,
      online: false,
      connectedAt: null,
      lastJob: last,
    });
  }
  return [...byId.values()].sort((a, b) => a.hostname.localeCompare(b.hostname, "tr"));
}

export function publicSnapshot(
  state: DeskState,
  online: readonly OnlineMachine[],
  rules: Pick<KnowledgePack, "version" | "vatDescription" | "cashAccount" | "vatAccount" | "expenseAccount">,
): DeskSnapshot {
  return {
    type: "snapshot",
    rulesVersion: rules.version,
    vatDescription: rules.vatDescription,
    cashAccount: rules.cashAccount,
    vatAccount: rules.vatAccount,
    expenseAccount: rules.expenseAccount,
    where: DESK_WHERE,
    machines: machineViews(state, online),
  };
}
