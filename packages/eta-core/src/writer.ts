import { encodeCp1254 } from "./cp1254.ts";
import { kurusToDecimalString, type Kurus } from "./money.ts";
import { totals, type IsoDate, type PlanLine, type Side, type VoucherPlan } from "./types.ts";

/** SQL layer binds these. CP1254 text is sent as bytes so ETA never sees UTF-8. */
export type SqlValue =
  | string
  | number
  | Date
  | null
  | { encoding: "cp1254"; text: string; maxBytes: number };

export interface BuiltVoucher {
  header: Record<string, SqlValue>;
  lines: Record<string, SqlValue>[];
  debitTotal: Kurus;
  creditTotal: Kurus;
}

export interface BuildVoucherInput {
  plan: VoucherPlan;
  refNo: number;
  voucherNo: string;
  /** All MUHFIS columns of a previous same-type voucher in this company. */
  headerTemplate: Record<string, unknown>;
  /** All MUHHAR columns of a previous same-type line in this company. */
  lineTemplate: Record<string, unknown>;
  descriptionMaxBytes?: number;
}

const ETA_EMPTY_DATE = new Date(Date.UTC(1900, 0, 1));

const HEADER_OVERLAY_KEYS = [
  "MUHFISTAR",
  "MUHFISNO",
  "MUHFISREFNO",
  "MUHFISBORCTOP",
  "MUHFISALACAKTOP",
  "MUHFISBELTUR",
  "MUHFISOZELKOD1",
  "MUHFISEKCHAR2",
] as const;

const LINE_OVERLAY_KEYS = [
  "MUHHARTAR",
  "MUHHARREFNO",
  "MUHHARSIRANO",
  "MUHHARMUHKOD",
  "MUHHARACIKLAMA",
  "MUHHARBATIPI",
  "MUHHARTUTAR",
  "MUHHAREVRAKNO",
  "MUHHAROZELKOD",
  "MUHHARACIKLAMA1",
  "MUHHARACIKLAMA2",
  "MUHHARACIKLAMA3",
  "MUHHARMIKTUT",
  "MUHHARNO",
  "MUHHAREVRAKTAR",
  "MUHHARBELTUR",
  "MUHHARVKNTCKNO",
] as const;

/**
 * Clone a previous voucher of the same type, then overlay only the fields that
 * come from the plan (Ç9: HAZKOD / KONTKOD / ONAYKOD / ISYKOD stay on the template).
 */
export function buildVoucher(input: BuildVoucherInput): BuiltVoucher {
  const { plan, refNo, voucherNo } = input;
  const maxBytes = input.descriptionMaxBytes ?? 80;
  const { debit, credit } = totals(plan.lines);

  const header = cloneRecord(input.headerTemplate);
  overlay(header, {
    MUHFISTAR: isoToDate(plan.headerDate),
    MUHFISNO: voucherNo,
    MUHFISREFNO: refNo,
    MUHFISBORCTOP: toSqlDecimal(debit),
    MUHFISALACAKTOP: toSqlDecimal(credit),
    MUHFISBELTUR: plan.kind,
    MUHFISOZELKOD1: plan.specialCode1 ?? spaceFrom(input.headerTemplate, "MUHFISOZELKOD1"),
    MUHFISEKCHAR2: cp1254(plan.headerNote ?? " ", maxBytes),
  });
  ensureVisibilityDefaults(header);

  const lines = plan.lines.map((line) => buildLine(line, input.lineTemplate, refNo, voucherNo, plan.kind, maxBytes));

  return { header, lines, debitTotal: debit, creditTotal: credit };
}

/** CP1254 bytes ready for `CAST(@bytes AS varchar(n))` or a VarBinary parameter. */
export function encodeField(value: { encoding: "cp1254"; text: string; maxBytes: number }): Buffer {
  const bytes = encodeCp1254(value.text);
  return bytes.length <= value.maxBytes ? bytes : bytes.subarray(0, value.maxBytes);
}

export function overlayKeys(): { header: readonly string[]; line: readonly string[] } {
  return { header: HEADER_OVERLAY_KEYS, line: LINE_OVERLAY_KEYS };
}

function buildLine(
  line: PlanLine,
  template: Record<string, unknown>,
  refNo: number,
  voucherNo: string,
  kind: string,
  maxBytes: number,
): Record<string, SqlValue> {
  const row = cloneRecord(template);
  overlay(row, {
    MUHHARTAR: isoToDate(line.lineDate),
    MUHHARREFNO: refNo,
    MUHHARSIRANO: line.seq,
    MUHHARMUHKOD: line.account,
    MUHHARACIKLAMA: cp1254(line.description, maxBytes),
    MUHHARBATIPI: sideToEta(line.side),
    MUHHARTUTAR: toSqlDecimal(line.amount),
    MUHHAREVRAKNO: line.docNo,
    MUHHAROZELKOD: line.specialCode ?? spaceFrom(template, "MUHHAROZELKOD"),
    MUHHARACIKLAMA1: cp1254(line.detail?.reference ?? " ", maxBytes),
    MUHHARACIKLAMA2: cp1254(line.detail?.item ?? " ", maxBytes),
    MUHHARACIKLAMA3: cp1254(line.detail?.unit ?? " ", 20),
    MUHHARMIKTUT: line.detail?.quantity ?? 0,
    MUHHARNO: voucherNo,
    MUHHAREVRAKTAR: isoToDate(line.docDate),
    MUHHARBELTUR: kind,
    MUHHARVKNTCKNO: " ",
  });
  return row;
}

function ensureVisibilityDefaults(header: Record<string, SqlValue>) {
  if (isBlank(header.MUHFISISYKOD)) header.MUHFISISYKOD = "MERKEZ";
  if (isBlank(header.MUHFISSAAT)) header.MUHFISSAAT = "12:00";
  if (header.MUHFISKAYITONC === undefined || header.MUHFISKAYITONC === null) header.MUHFISKAYITONC = 4;
  if (header.MUHFISSEVNO === undefined || header.MUHFISSEVNO === null) header.MUHFISSEVNO = 1;
}

function cloneRecord(source: Record<string, unknown>): Record<string, SqlValue> {
  const out: Record<string, SqlValue> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = normalizeTemplateValue(value);
  }
  return out;
}

function overlay(target: Record<string, SqlValue>, values: Record<string, SqlValue>) {
  Object.assign(target, values);
}

function normalizeTemplateValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return String(value);
}

function isoToDate(iso: IsoDate): Date {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return ETA_EMPTY_DATE;
  return new Date(Date.UTC(year, month - 1, day));
}

function toSqlDecimal(kurus: Kurus): number {
  return Number(kurusToDecimalString(kurus));
}

function sideToEta(side: Side): number {
  return side === "D" ? 1 : 2;
}

function cp1254(text: string, maxBytes: number): SqlValue {
  return { encoding: "cp1254", text, maxBytes };
}

function spaceFrom(template: Record<string, unknown>, key: string): string {
  const value = template[key];
  return typeof value === "string" && value.length > 0 ? value : " ";
}

function isBlank(value: SqlValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}
