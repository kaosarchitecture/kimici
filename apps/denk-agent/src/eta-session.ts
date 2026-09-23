import { formatTr, tlToKurus } from "../../../packages/eta-core/src/money.ts";
import { buildVoucher, type BuiltVoucher } from "../../../packages/eta-core/src/writer.ts";
import { validatePlan } from "../../../packages/eta-core/src/guards.ts";
import { nextRef, nextVoucherNo, parseVoucherNo } from "../../../packages/eta-core/src/numbering.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";

export const LOCAL_SQL_SERVERS = ["localhost", ".", "localhost\\SQLEXPRESS", ".\\SQLEXPRESS"] as const;

const DATABASE_QUERY = "SELECT name FROM sys.databases WHERE database_id > 4 ORDER BY name";
const COMPANY_QUERY = "SELECT SIRKOD, SIRDBNAME, SIRPATH FROM SIRKET";
const TEMPLATE_QUERY = "SELECT TOP 1 MUHFISREFNO AS refNo FROM MUHFIS";
const VOUCHER_QUERY =
  "SELECT TOP 5 MUHFISREFNO AS refNo, MUHFISNO AS voucherNo, MUHFISTAR AS voucherDate, MUHFISSEVNO AS versionNo, MUHFISBELTUR AS kind, MUHFISBORCTOP AS debit, MUHFISALACAKTOP AS credit FROM MUHFIS ORDER BY MUHFISREFNO DESC";
const COMPANY_DB = /^ETA_[A-Z0-9]+_\d{4}$/;
const COMPANY_CODE = /^[\p{L}\p{N}_.-]{1,40}$/u;

export interface EtaAccess {
  sql: boolean;
  companies: string[];
  build: "open" | "closed";
}

export interface ReadLine {
  seq: number;
  account: string;
  side: "B" | "A" | "";
  amount: string;
  description: string;
  date: string;
}

export interface ReadVoucher {
  company: string;
  voucherNo: string;
  date: string;
  debit: string;
  credit: string;
  version: string;
  kind: string;
  lines: ReadLine[];
}

export interface LocalRead {
  databases: string[];
  companies: string[];
  vouchers: ReadVoucher[];
  files: string[];
}

export interface EtaSession extends EtaAccess, LocalRead {
  server: string | null;
  readyDatabases: string[];
}

export interface SqlPort {
  query(server: string, database: string, statement: string): Promise<Record<string, unknown>[]>;
}

export function localConnectionString(server: string, database: string): string {
  if (!/^[\w.\\-]+$/.test(server)) throw new Error("SQL sunucu adı geçersiz.");
  if (database !== "master" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(database)) {
    throw new Error("Veritabanı adı geçersiz.");
  }
  const connectionString = `Server=${server};Database=${database};Integrated Security=True;TrustServerCertificate=True`;
  if (/password|pwd|user\s*id|uid\s*=/i.test(connectionString)) {
    throw new Error("SQL kullanıcı adı veya parola kullanılmaz.");
  }
  if (!/Integrated Security\s*=\s*True/i.test(connectionString)) {
    throw new Error("Bağlantı yalnız Windows kimliğiyle açılır.");
  }
  return connectionString;
}

export async function readMachine(
  port: SqlPort,
  listDir: (dir: string) => Promise<string[]> = async () => [],
  servers: readonly string[] = LOCAL_SQL_SERVERS,
): Promise<EtaSession> {
  let fallback: EtaSession | null = null;
  for (const server of servers) {
    let listed: Record<string, unknown>[];
    try {
      listed = await port.query(server, "master", DATABASE_QUERY);
    } catch {
      continue;
    }
    const databases = listed.map((row) => text(row, "name")).filter(Boolean).slice(0, 40);
    const seen: EtaSession = {
      sql: true,
      databases,
      companies: [],
      vouchers: [],
      files: [],
      build: "closed",
      server,
      readyDatabases: [],
    };
    if (!databases.includes("ETA_MASTERV8")) {
      fallback ??= seen;
      continue;
    }

    const companies = await port.query(server, "ETA_MASTERV8", COMPANY_QUERY);
    for (const row of companies) {
      const code = text(row, "SIRKOD");
      const database = text(row, "SIRDBNAME");
      if (!COMPANY_CODE.test(code) || !COMPANY_DB.test(database)) continue;
      seen.companies.push(code);
      try {
        const template = await port.query(server, database, TEMPLATE_QUERY);
        if (template.length > 0) seen.readyDatabases.push(database);
        const vouchers = await port.query(server, database, VOUCHER_QUERY);
        const drafts: { refNo: number; voucher: ReadVoucher }[] = [];
        for (const voucher of vouchers) {
          const voucherNo = text(voucher, "voucherNo");
          if (!voucherNo) continue;
          drafts.push({
            refNo: finite(voucher.refNo),
            voucher: {
              company: code,
              voucherNo,
              date: text(voucher, "voucherDate").slice(0, 10),
              debit: money(voucher.debit),
              credit: money(voucher.credit),
              version: text(voucher, "versionNo"),
              kind: text(voucher, "kind"),
              lines: [],
            },
          });
        }
        const refs = drafts.map((item) => item.refNo).filter((ref) => ref > 0);
        if (refs.length > 0) {
          const lines = await port.query(server, database, lineQuery(refs));
          for (const line of lines) {
            const target = drafts.find((item) => item.refNo === finite(line.refNo));
            if (!target || target.voucher.lines.length >= 40) continue;
            target.voucher.lines.push({
              seq: finite(line.seq),
              account: text(line, "account"),
              side: sideOf(line.side),
              amount: money(line.amount),
              description: text(line, "description"),
              date: text(line, "lineDate").slice(0, 10),
            });
          }
        }
        seen.vouchers.push(...drafts.map((item) => item.voucher));
      } catch {
        // This company database did not answer. The others still count.
      }
      const dir = text(row, "SIRPATH");
      if (!/^[A-Za-z]:\\[^:*?"<>|]+$/.test(dir) || dir.includes("..")) continue;
      try {
        const names = await listDir(dir);
        for (const name of names) {
          if (!name || name.startsWith(".")) continue;
          seen.files.push(name.slice(0, 120));
          if (seen.files.length >= 20) break;
        }
      } catch {
        // The path is not readable in this session.
      }
    }
    seen.build = seen.readyDatabases.length > 0 ? "open" : "closed";
    return seen;
  }
  return (
    fallback ?? { sql: false, databases: [], companies: [], vouchers: [], files: [], build: "closed", server: null, readyDatabases: [] }
  );
}

export function etaNote(access: EtaSession): string {
  if (!access.sql) return "Bu oturum SQL okuyamadı.";
  const databases = access.databases.join(", ") || "yok";
  if (access.companies.length === 0) return `Windows oturumuyla okundu. Veritabanı: ${databases}. ETA yok.`;
  const build = access.build === "open" ? "Build açık." : "Build kapalı.";
  return `Windows oturumuyla okundu. Veritabanı: ${databases}. Şirket: ${access.companies.join(", ")}. Fiş: ${access.vouchers.length}. ${build}`;
}

function lineQuery(refs: number[]): string {
  const list = refs.filter((ref) => Number.isInteger(ref) && ref > 0).join(",");
  return `SELECT MUHHARREFNO AS refNo, MUHHARSIRANO AS seq, MUHHARMUHKOD AS account, MUHHARBATIPI AS side, MUHHARTUTAR AS amount, MUHHARACIKLAMA AS description, MUHHARTAR AS lineDate FROM MUHHAR WHERE MUHHARREFNO IN (${list}) ORDER BY MUHHARREFNO, MUHHARSIRANO`;
}

function sideOf(value: unknown): "B" | "A" | "" {
  const number = typeof value === "number" ? value : Number(value);
  if (number === 1 || value === "B") return "B";
  if (number === 2 || value === "A") return "A";
  return "";
}

function money(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatTr(tlToKurus(value));
  return text({ value }, "value");
}

/** Read this company's own last voucher and build the next one. Nothing is written here. */
export async function buildFromTemplate(
  port: SqlPort,
  server: string,
  database: string,
  plan: VoucherPlan,
): Promise<BuiltVoucher> {
  if (!COMPANY_DB.test(database)) throw new Error("Veritabanı adı geçersiz.");
  if (plan.companyDb !== database) throw new Error("Plan başka şirkete ait.");
  const violations = validatePlan(plan);
  if (violations.length > 0) throw new Error(violations.map((item) => item.message).join(" "));

  const headers = await port.query(server, database, "SELECT TOP 1 * FROM MUHFIS ORDER BY MUHFISREFNO DESC");
  const header = headers[0];
  if (!header) throw new Error("Şablon fiş yok.");
  const templateRef = finite(header.MUHFISREFNO);
  const lines = await port.query(
    server,
    database,
    `SELECT TOP 1 * FROM MUHHAR WHERE MUHHARREFNO = ${templateRef} ORDER BY MUHHARSIRANO`,
  );
  const line = lines[0];
  if (!line) throw new Error("Şablon satır yok.");

  const [liveRef, lineRef, cancelRef, liveNo, cancelNo] = await Promise.all([
    port.query(server, database, "SELECT ISNULL(MAX(MUHFISREFNO), 0) AS refNo FROM MUHFIS"),
    port.query(server, database, "SELECT ISNULL(MAX(MUHHARREFNO), 0) AS refNo FROM MUHHAR"),
    port.query(server, database, "SELECT ISNULL(MAX(MUHFISREFNO), 0) AS refNo FROM MUHFISIPTAL"),
    port.query(server, database, "SELECT MAX(MUHFISNO) AS voucherNo FROM MUHFIS"),
    port.query(server, database, "SELECT MAX(MUHFISNO) AS voucherNo FROM MUHFISIPTAL"),
  ]);

  return buildVoucher({
    plan,
    refNo: nextRef({
      maxMuhfisRef: finite(liveRef[0]?.refNo),
      maxMuhharRef: finite(lineRef[0]?.refNo),
      maxCancelledRef: finite(cancelRef[0]?.refNo),
    }),
    voucherNo: nextVoucherNo({
      maxLiveSequence: sequence(liveNo[0]?.voucherNo),
      maxCancelledSequence: sequence(cancelNo[0]?.voucherNo),
    }),
    headerTemplate: header,
    lineTemplate: line,
  });
}

function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return value == null ? "" : String(value).trim();
}

function finite(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.trunc(number);
}

function sequence(value: unknown): number {
  if (typeof value !== "string") return 0;
  return parseVoucherNo(value) ?? 0;
}
