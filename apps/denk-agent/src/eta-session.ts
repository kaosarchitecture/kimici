import { formatTr, tlToKurus } from "../../../packages/eta-core/src/money.ts";
import { buildVoucher, type BuiltVoucher } from "../../../packages/eta-core/src/writer.ts";
import { validatePlan } from "../../../packages/eta-core/src/guards.ts";
import { nextRef, nextVoucherNo, parseVoucherNo } from "../../../packages/eta-core/src/numbering.ts";
import type { VoucherPlan } from "../../../packages/eta-core/src/types.ts";

export const LOCAL_SQL_SERVERS = ["localhost", ".", "localhost\\SQLEXPRESS", ".\\SQLEXPRESS"] as const;

const DATABASE_QUERY = "SELECT name FROM sys.databases WHERE database_id > 4 AND state = 0 ORDER BY name";
const SCHEMA_QUERY =
  "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('SIRKET', 'MUHFIS', 'MUHHAR')";
const ETA_TABLES = ["SIRKET", "MUHFIS", "MUHHAR"] as const;
const SIRKET_COLUMNS = ["SIRKOD", "SIRDBNAME", "SIRPATH"] as const;
const HEADER_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["MUHFISREFNO", "refNo"],
  ["MUHFISNO", "voucherNo"],
  ["MUHFISTAR", "voucherDate"],
  ["MUHFISSEVNO", "versionNo"],
  ["MUHFISBELTUR", "kind"],
  ["MUHFISBORCTOP", "debit"],
  ["MUHFISALACAKTOP", "credit"],
];
const LINE_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ["MUHHARREFNO", "refNo"],
  ["MUHHARSIRANO", "seq"],
  ["MUHHARMUHKOD", "account"],
  ["MUHHARBATIPI", "side"],
  ["MUHHARTUTAR", "amount"],
  ["MUHHARACIKLAMA", "description"],
  ["MUHHARTAR", "lineDate"],
];
const COMPANY_DB = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BUILDABLE_DB = /^ETA_[A-Z0-9]+_\d{4}$/;
const COMPANY_CODE = /^[\p{L}\p{N}_.-]{1,40}$/u;
const SERVER_NAME = /^(?:\(local\)|\.)(?:\\[\w.-]+)?(?:,\d{1,5})?$|^(?:tcp:)?[\w.-]+(?:\\[\w.-]+)?(?:,\d{1,5})?$/;

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

export function isSqlServerName(server: string): boolean {
  return SERVER_NAME.test(server);
}

export function pathFacts(found: EtaSession): string {
  const vouchers = found.vouchers
    .slice(0, 5)
    .map((voucher) => `${voucher.voucherNo} ${voucher.company} sürüm ${voucher.version || "-"}`)
    .join(", ");
  return [
    `sunucu=${found.server ?? "yok"}`,
    `veritabanı=${found.databases.join(", ") || "yok"}`,
    `şirket=${found.companies.join(", ") || "yok"}`,
    `fiş=${vouchers || "yok"}`,
    `build=${found.build === "open" ? "açık" : "kapalı"}`,
  ].join("\n");
}

export function localConnectionString(server: string, database: string): string {
  if (!isSqlServerName(server)) throw new Error("SQL sunucu adı geçersiz.");
  if (database !== "master" && !COMPANY_DB.test(database)) {
    throw new Error("Veritabanı adı geçersiz.");
  }
  const connectionString = `Server=${server};Database=${database};Integrated Security=True;TrustServerCertificate=True;Connect Timeout=3`;
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
  log: (line: string) => void = () => {},
): Promise<EtaSession> {
  const targets = servers.map((server) => server.trim()).filter(Boolean).slice(0, 8);
  log(`SQL hedefleri: ${targets.join(", ") || "yok"}`);
  let fallback: EtaSession | null = null;
  for (const server of targets) {
    if (!isSqlServerName(server)) {
      log(`${server} SQL hedefi olarak kullanılmadı.`);
      continue;
    }
    log(`${server} açılıyor.`);
    let listed: Record<string, unknown>[];
    try {
      listed = await port.query(server, "master", DATABASE_QUERY);
    } catch {
      log(`${server} açılmadı.`);
      continue;
    }
    const databases = listed
      .map((row) => text(row, "name"))
      .filter((name) => COMPANY_DB.test(name))
      .slice(0, 40);
    log(`${server} açıldı. Veritabanı: ${databases.join(", ") || "yok"}`);
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
    const schemas = new Map<string, Map<string, Set<string>>>();
    for (const database of databases) await probe(port, server, database, schemas, log);

    const companyOf = new Map<string, string>();
    const follow = new Set<string>();
    for (const [database, schema] of schemas) {
      if (schema.has("MUHFIS")) follow.add(database);
      if (!schema.has("SIRKET")) continue;
      const columns = schema.get("SIRKET") ?? new Set<string>();
      const fields = SIRKET_COLUMNS.filter((column) => columns.has(column));
      if (fields.length === 0) continue;
      let companies: Record<string, unknown>[] = [];
      try {
        companies = await port.query(server, database, `SELECT ${fields.join(", ")} FROM SIRKET`);
      } catch {
        log(`${server} / ${database}: şirket listesi okunamadı.`);
        continue;
      }
      for (const row of companies) {
        if (seen.companies.length >= 30) break;
        const code = text(row, "SIRKOD");
        const target = text(row, "SIRDBNAME");
        if (COMPANY_CODE.test(code)) {
          if (!seen.companies.includes(code)) seen.companies.push(code);
          if (COMPANY_DB.test(target)) companyOf.set(target, code);
          log(`Şirket ${code}${COMPANY_DB.test(target) ? `, veritabanı ${target}` : ""}.`);
        }
        if (COMPANY_DB.test(target)) follow.add(target);
        await readCompanyFiles(listDir, text(row, "SIRPATH"), seen);
      }
    }

    for (const database of [...follow].slice(0, 20)) {
      if (!schemas.has(database)) await probe(port, server, database, schemas, log);
      const schema = schemas.get(database);
      const columns = schema?.get("MUHFIS");
      if (!columns) continue;
      const company = companyOf.get(database) || database;
      if (!seen.companies.includes(company) && COMPANY_CODE.test(company)) seen.companies.push(company);
      try {
        if (columns.has("MUHFISREFNO") && BUILDABLE_DB.test(database)) {
          const template = await port.query(server, database, "SELECT TOP 1 MUHFISREFNO AS refNo FROM MUHFIS");
          if (template.length > 0 && !seen.readyDatabases.includes(database)) seen.readyDatabases.push(database);
        }
        const vouchers = await readVoucherRows(port, server, database, columns, schema?.get("MUHHAR") ?? new Set<string>(), company);
        if (vouchers.length > 0) log(`${database}: fiş ${vouchers.length}.`);
        seen.vouchers.push(...vouchers);
      } catch {
        log(`${database}: fiş okunamadı.`);
      }
      if (seen.vouchers.length >= 20) break;
    }
    seen.vouchers = seen.vouchers.slice(0, 20);
    seen.build = seen.readyDatabases.length > 0 ? "open" : "closed";
    if (seen.companies.length > 0 || seen.vouchers.length > 0) return seen;
    log(`${server}: ETA tablosu yok.`);
    fallback ??= seen;
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

async function probe(
  port: SqlPort,
  server: string,
  database: string,
  schemas: Map<string, Map<string, Set<string>>>,
  log: (line: string) => void,
): Promise<void> {
  if (schemas.has(database) || !COMPANY_DB.test(database)) return;
  try {
    const rows = await port.query(server, database, SCHEMA_QUERY);
    const tables = new Map<string, Set<string>>();
    for (const row of rows) {
      const table = (text(row, "tableName") || text(row, "TABLE_NAME")).toUpperCase();
      const column = (text(row, "columnName") || text(row, "COLUMN_NAME")).toUpperCase();
      if (!ETA_TABLES.includes(table as (typeof ETA_TABLES)[number])) continue;
      if (!/^[A-Z0-9_]+$/.test(column)) continue;
      const columns = tables.get(table) ?? new Set<string>();
      columns.add(column);
      tables.set(table, columns);
    }
    schemas.set(database, tables);
    const found = [...tables.keys()];
    if (found.length > 0) log(`${server} / ${database}: ${found.join(", ")}`);
  } catch {
    schemas.set(database, new Map());
    log(`${server} / ${database}: okunamadı.`);
  }
}

async function readVoucherRows(
  port: SqlPort,
  server: string,
  database: string,
  columns: Set<string>,
  lineColumns: Set<string>,
  company: string,
): Promise<ReadVoucher[]> {
  const fields = HEADER_COLUMNS.filter(([column]) => columns.has(column));
  if (!fields.some(([column]) => column === "MUHFISNO")) return [];
  const order = columns.has("MUHFISREFNO") ? " ORDER BY MUHFISREFNO DESC" : "";
  const listed = await port.query(
    server,
    database,
    `SELECT TOP 5 ${fields.map(([column, alias]) => `${column} AS ${alias}`).join(", ")} FROM MUHFIS${order}`,
  );
  const drafts: { refNo: number; voucher: ReadVoucher }[] = [];
  for (const voucher of listed) {
    const voucherNo = text(voucher, "voucherNo");
    if (!voucherNo) continue;
    drafts.push({
      refNo: finite(voucher.refNo),
      voucher: {
        company,
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
  const statement = lineQuery(refs, lineColumns);
  if (statement) {
    const lines = await port.query(server, database, statement);
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
  return drafts.map((item) => item.voucher);
}

function lineQuery(refs: number[], columns: Set<string>): string {
  if (!columns.has("MUHHARREFNO")) return "";
  const list = refs.filter((ref) => Number.isInteger(ref) && ref > 0).join(",");
  if (!list) return "";
  const fields = LINE_COLUMNS.filter(([column]) => columns.has(column));
  const order = columns.has("MUHHARSIRANO") ? " ORDER BY MUHHARREFNO, MUHHARSIRANO" : " ORDER BY MUHHARREFNO";
  return `SELECT ${fields.map(([column, alias]) => `${column} AS ${alias}`).join(", ")} FROM MUHHAR WHERE MUHHARREFNO IN (${list})${order}`;
}

async function readCompanyFiles(listDir: (dir: string) => Promise<string[]>, dir: string, seen: EtaSession): Promise<void> {
  if (!/^[A-Za-z]:\\[^:*?"<>|]+$/.test(dir) || dir.includes("..") || seen.files.length >= 20) return;
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
