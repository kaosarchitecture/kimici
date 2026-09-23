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

export interface JobRecord {
  jobId: string;
  machineId: string;
  hostname: string;
  status: "running" | "done" | "empty" | "blocked" | "dropped" | "failed";
  startedAt: string;
  finishedAt?: string;
  note: string;
  vouchers: DeskVoucher[];
  modelNote?: string;
  windowsAccount?: string;
  eta?: EtaAccess;
  read?: LocalRead;
}

export interface LocalRead {
  databases: string[];
  companies: string[];
  vouchers: {
    company: string;
    voucherNo: string;
    date: string;
    debit: string;
    credit: string;
    version: string;
    kind: string;
    lines: { seq: number; account: string; side: "B" | "A" | ""; amount: string; description: string; date: string }[];
  }[];
  files: string[];
}

export interface EtaAccess {
  sql: boolean;
  companies: string[];
  build: "open" | "closed";
}

export interface MachineView {
  machineId: string;
  hostname: string;
  online: boolean;
  connectedAt: string | null;
  lastJob: JobRecord | null;
}

export interface DeskSnapshot {
  rulesVersion: string;
  vatDescription: string;
  cashAccount: string;
  vatAccount: string;
  expenseAccount: string;
  where: string;
  machines: MachineView[];
}

export async function loadDesk(): Promise<DeskSnapshot> {
  const res = await fetch("/api/machines");
  if (!res.ok) throw new Error("Merkez kapalı.");
  return (await res.json()) as DeskSnapshot;
}

export async function runOnMachine(machineId: string): Promise<void> {
  const res = await fetch(`/api/machines/${encodeURIComponent(machineId)}/run`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? "İşlem başlatılamadı.");
  }
}

export function deskSocketUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/api/desk`;
}
