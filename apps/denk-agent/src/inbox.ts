import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { decimalStringToKurus, formatTr, tlToKurus } from "../../../packages/eta-core/src/money.ts";
import type { DeskVoucher } from "../../../packages/consent-view/src/desk.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { documentFromFile } from "../../../packages/consent-view/src/ubl.ts";
import { planLocalFields, type LocalFields } from "./process.ts";

const MAX_FILES = 20;
const MAX_BYTES = 2 * 1024 * 1024;

export interface InboxResult {
  status: "done" | "empty" | "blocked" | "failed";
  note: string;
  vouchers: DeskVoucher[];
}

export async function runInbox(localDir: string, pack: KnowledgePack): Promise<InboxResult> {
  let names: string[] = [];
  try {
    names = await readdir(localDir);
  } catch {
    return { status: "empty", note: "Bu bilgisayarda iş klasörü yok.", vouchers: [] };
  }

  const files = names.filter((name) => !name.startsWith(".")).sort((a, b) => a.localeCompare(b, "tr")).slice(0, MAX_FILES);
  const vouchers: DeskVoucher[] = [];
  const problems: string[] = [];

  for (const name of files) {
    const kind = classify(name);
    if (!kind) continue;
    try {
      const full = join(localDir, name);
      const raw = await readFile(full);
      if (raw.byteLength > MAX_BYTES) {
        problems.push(`${name}: 2 MB üstü atlandı.`);
        continue;
      }
      const text = raw.toString("utf8").replace(/^\uFEFF/, "");
      for (const fields of recordsFrom(name, kind, text)) {
        vouchers.push(planLocalFields(fields, pack));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "okunamadı";
      problems.push(`${name}: ${message}`);
    }
  }

  const extra = names.length > MAX_FILES ? ` İlk ${MAX_FILES} dosyaya bakıldı.` : "";
  if (vouchers.length === 0 && problems.length === 0) {
    return {
      status: "empty",
      note: `Bu bilgisayarda log, audit veya XML yok.${extra} Klasör: ${basename(localDir) || localDir}`,
      vouchers: [],
    };
  }

  const blocked = vouchers.some((row) => row.blockers.length > 0);
  const status = vouchers.length === 0 ? "failed" : blocked ? "blocked" : "done";
  const kinds = [...new Set(vouchers.map((row) => row.sourceKind))].join(", ");
  const head = vouchers.length
    ? `${vouchers.length} kayıt bu bilgisayarda işlendi (${kinds || "yok"}). Kural ${pack.version}.`
    : "Bu bilgisayarda fiş kurulamadı.";
  const note = `${[head, ...problems].join(" ")}${extra}`.slice(0, 500);
  return { status, note, vouchers };
}

function classify(name: string): "xml" | "audit" | "log" | null {
  const lower = name.toLocaleLowerCase("tr-TR");
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".json") && lower.includes("audit")) return "audit";
  if (lower.endsWith(".log") || lower.endsWith(".log.txt") || (lower.includes("log") && lower.endsWith(".txt"))) return "log";
  return null;
}

function recordsFrom(name: string, kind: "xml" | "audit" | "log", text: string): LocalFields[] {
  if (kind === "xml") return [fieldsFromXml(name, text)];
  if (kind === "audit") return auditRecords(name, text);
  return logRecords(name, text);
}

function fieldsFromXml(name: string, text: string): LocalFields {
  const document = documentFromFile(name, "application/xml", text.length, text);
  return {
    sourceName: name,
    sourceKind: "xml",
    invoiceNo: document.invoiceNo,
    issueDate: normalizeDate(document.issueDate),
    supplierName: document.supplierName,
    netText: document.netText,
    vatText: document.vatText,
    payableText: document.payableText,
  };
}

function auditRecords(name: string, text: string): LocalFields[] {
  const parsed = JSON.parse(text) as unknown;
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows.map((row, index) => {
    if (!row || typeof row !== "object") throw new Error("audit kaydı nesne değil");
    const record = row as Record<string, unknown>;
    const suffix = rows.length > 1 ? `#${index + 1}` : "";
    return {
      sourceName: `${name}${suffix}`,
      sourceKind: "audit",
      invoiceNo: pick(record, ["invoiceNo", "evrak", "fatura", "id"]),
      issueDate: normalizeDate(pick(record, ["issueDate", "tarih", "date"])),
      supplierName: pick(record, ["supplierName", "unvan", "tedarikci", "tedarikçi", "name"]),
      netText: asAmount(pickRaw(record, ["net", "netText", "matrah"])),
      vatText: asAmount(pickRaw(record, ["vat", "vatText", "kdv"])),
      payableText: asAmount(pickRaw(record, ["payable", "payableText", "odenecek", "ödenecek"])),
    };
  });
}

function logRecords(name: string, text: string): LocalFields[] {
  const blocks = text
    .split(/\n(?=(?:EVRAK|FATURA)\b)/i)
    .map((block) => block.trim())
    .filter(Boolean);
  return blocks.map((block, index) => {
    const bag: Record<string, string> = {};
    for (const line of block.split(/\r?\n/)) {
      const match = /^([\p{L}\p{N}.]+)(?:\s*[:=]\s*|\s+)(\S.*)$/u.exec(line.trim());
      if (!match) continue;
      const key = foldKey(match[1] ?? "");
      const value = (match[2] ?? "").trim();
      const field = LOG_KEYS[key];
      if (field) bag[field] = value;
    }
    const suffix = blocks.length > 1 ? `#${index + 1}` : "";
    return {
      sourceName: `${name}${suffix}`,
      sourceKind: "log" as const,
      invoiceNo: bag.invoiceNo ?? "",
      issueDate: normalizeDate(bag.issueDate ?? ""),
      supplierName: bag.supplierName ?? "",
      netText: bag.net ?? "",
      vatText: bag.vat ?? "",
      payableText: bag.payable ?? "",
    };
  });
}

const LOG_KEYS: Record<string, "invoiceNo" | "issueDate" | "supplierName" | "net" | "vat" | "payable"> = {
  evrak: "invoiceNo",
  fatura: "invoiceNo",
  invoiceno: "invoiceNo",
  tarih: "issueDate",
  issuedate: "issueDate",
  unvan: "supplierName",
  tedarikci: "supplierName",
  tedarikçi: "supplierName",
  suppliername: "supplierName",
  matrah: "net",
  kdv: "vat",
  odenecek: "payable",
  ödenecek: "payable",
};

function pick(record: Record<string, unknown>, names: readonly string[]): string {
  const raw = pickRaw(record, names);
  return raw == null ? "" : String(raw).trim();
}

function foldKey(raw: string): string {
  return raw.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/\./g, "");
}

function pickRaw(record: Record<string, unknown>, names: readonly string[]): unknown {
  const wanted = new Set(names.map((name) => foldKey(name)));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(foldKey(key))) return value;
  }
  return undefined;
}

function asAmount(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") return formatTr(tlToKurus(value));
  const text = String(value).trim();
  if (/^-?\d+\.\d{1,2}$/.test(text)) return formatTr(decimalStringToKurus(text));
  return text;
}

export function normalizeDate(raw: string): string {
  const text = raw.trim();
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(text);
  if (tr) return `${tr[3]}-${tr[2]}-${tr[1]}`;
  return text.slice(0, 10);
}
