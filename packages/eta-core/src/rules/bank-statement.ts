import { rootAccount } from "../accounts.ts";
import { fitCp1254 } from "../cp1254.ts";
import type { Kurus } from "../money.ts";
import type { Blocker, IsoDate, PlanLine, VoucherPlan } from "../types.ts";

export interface BankRow {
  date: IsoDate;
  /** Signed: positive = money in (bank debit), negative = money out (bank credit). */
  amount: Kurus;
  transactionType: string;
  description: string;
  /** Extra free text such as the transfer counterparty column. */
  counterpartyText?: string;
  /** Statement transaction number, written to MUHHAREVRAKNO. */
  docNo: string;
}

/** Company specific mapping learned from previous months (preflight), checked before cari lookup. */
export interface SpecialBankRule {
  id: string;
  /** Case-insensitive keywords; any match on type, description or counterparty text triggers the rule. */
  keywords: string[];
  account: string;
  label: string;
}

export interface CariCandidate {
  code: string;
  name: string;
  taxId?: string;
}

export interface CounterpartMatch {
  account: string;
  ruleId: string;
  label: string;
}

const LEGAL_SUFFIXES = [
  "LTD.ŞTİ.", "LTD. ŞTİ.", "A.Ş.", "SAN.VE", "TİC.", "SANAYİ", "TİCARET", "LİMİTED", "ŞİRKETİ",
  "SAN.", "VE", "DAY.", "TÜK.", "MAL.",
];

export function upperTr(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}

export function cariTokens(name: string): string[] {
  let cleaned = upperTr(name);
  for (const suffix of LEGAL_SUFFIXES) cleaned = cleaned.split(suffix).join(" ");
  return cleaned.split(/\s+/).filter((token) => token.length >= 4);
}

/**
 * Kural 15 priority: special type → cari (tax id, then all name tokens) → unmatched account.
 * Account 296 is never produced.
 */
export function classifyBankRow(
  row: BankRow,
  options: { specialRules: readonly SpecialBankRule[]; caris: readonly CariCandidate[]; unmatchedAccount?: string },
): CounterpartMatch {
  const combined = [row.transactionType, row.description, row.counterpartyText ?? ""].join(" ");
  const combinedUpper = upperTr(combined);

  for (const rule of options.specialRules) {
    if (rule.keywords.some((keyword) => combinedUpper.includes(upperTr(keyword)))) {
      return { account: rule.account, ruleId: `R15.special.${rule.id}`, label: rule.label };
    }
  }
  for (const cari of options.caris) {
    if (cari.taxId && cari.taxId.length >= 8 && combined.includes(cari.taxId)) {
      return { account: cari.code, ruleId: "R15.cari.tax-id", label: cari.name };
    }
  }
  for (const cari of options.caris) {
    const tokens = cariTokens(cari.name);
    if (tokens.length >= 2 && tokens.every((token) => combinedUpper.includes(token))) {
      return { account: cari.code, ruleId: "R15.cari.name", label: cari.name };
    }
  }
  const unmatched = options.unmatchedAccount ?? "100 01";
  if (rootAccount(unmatched) === "296") {
    throw new Error("Eşleşmeyen banka satırı için 296 kullanılamaz (Kural 02/15).");
  }
  return { account: unmatched, ruleId: "R15.unmatched", label: "Eşleşmeyen" };
}

export interface BankMonthInput {
  companyDb: string;
  bankAccount: string;
  year: number;
  /** 1-12. */
  month: number;
  rows: readonly BankRow[];
  specialRules: readonly SpecialBankRule[];
  caris: readonly CariCandidate[];
  unmatchedAccount?: string;
  headerNote?: string;
  /** Byte limit of MUHHARACIKLAMA; read from sys.columns at write time. */
  descriptionMaxBytes?: number;
}

export function lastDayOfMonth(year: number, month: number): IsoDate {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Kural 18 monthly single voucher: header on the last day, lines on their own dates in order. */
export function planBankMonth(input: BankMonthInput): VoucherPlan {
  const blockers: Blocker[] = [];
  const prefix = `${input.year}-${String(input.month).padStart(2, "0")}-`;
  const outside = input.rows.filter((row) => !row.date.startsWith(prefix));
  if (outside.length > 0) {
    blockers.push({
      code: "ROW_OUTSIDE_MONTH",
      message: `${outside.length} ekstre satırı ${prefix.slice(0, 7)} dönemi dışında. Aylar karıştırılamaz.`,
    });
  }
  const zero = input.rows.filter((row) => row.amount === 0);
  if (zero.length > 0) {
    blockers.push({ code: "ZERO_AMOUNT_ROW", message: `${zero.length} ekstre satırının tutarı sıfır.` });
  }

  const ordered = input.rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => (a.row.date === b.row.date ? a.index - b.index : a.row.date < b.row.date ? -1 : 1));

  const maxBytes = input.descriptionMaxBytes ?? 80;
  const lines: Omit<PlanLine, "seq">[] = [];
  for (const { row } of ordered) {
    const match = classifyBankRow(row, input);
    const description = fitCp1254(row.description.trim() || row.transactionType, maxBytes);
    const amount = Math.abs(row.amount);
    const common = { amount, description, docNo: row.docNo, lineDate: row.date, docDate: row.date };
    const bank = { ...common, account: input.bankAccount, ruleId: "R02.bank-side" };
    const counter = { ...common, account: match.account, ruleId: match.ruleId };
    if (row.amount > 0) {
      lines.push({ ...bank, side: "D" }, { ...counter, side: "C" });
    } else {
      lines.push({ ...counter, side: "D" }, { ...bank, side: "C" });
    }
  }

  return {
    companyDb: input.companyDb,
    kind: "DEK",
    mode: "monthly-single",
    headerDate: lastDayOfMonth(input.year, input.month),
    ...(input.headerNote ? { headerNote: input.headerNote } : {}),
    lines: lines.map((line, index) => ({ ...line, seq: index + 1 })),
    blockers,
  };
}
