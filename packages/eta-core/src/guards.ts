import { rootAccount } from "./accounts.ts";
import { cp1254ByteLength, isCp1254Safe } from "./cp1254.ts";
import { NFT_THRESHOLD } from "./rules/purchase-invoice.ts";
import { lastDayOfMonth } from "./rules/bank-statement.ts";
import { totals, type PlanLine, type VoucherPlan } from "./types.ts";

export interface Violation {
  code: string;
  message: string;
  seq?: number;
}

export interface GuardOptions {
  descriptionMaxBytes?: number;
  /** Text columns written verbatim; checked for CP1254 safety and ASCII-fied Turkish. */
  cashRoots?: readonly string[];
}

/** ASCII spellings that ETA office texts must never contain (DENK rule 01.7). */
const ASCII_TURKISH = [/\bILE\s+(SATIS|ALIS)\b/, /\bN\.FT\s+ILE\b/, /\bIND\.?\s*KDV\b/, /\bHES\.?\s*KDV\b/, /\bYURT\s+ICI\b/];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Invariants every plan must satisfy before anything is written to ETA.
 * Returns all violations; an empty array means the plan may be shown for approval.
 */
export function validatePlan(plan: VoucherPlan, options: GuardOptions = {}): Violation[] {
  const violations: Violation[] = [];
  const maxBytes = options.descriptionMaxBytes ?? 80;
  const cashRoots = options.cashRoots ?? ["100"];

  for (const blocker of plan.blockers) {
    violations.push({ code: `BLOCKER.${blocker.code}`, message: blocker.message });
  }
  if (plan.lines.length === 0) {
    violations.push({ code: "EMPTY_VOUCHER", message: "Fişte satır yok." });
  }
  if (!/^ETA_[A-Z0-9]+_\d{4}$/.test(plan.companyDb)) {
    violations.push({ code: "SINGLE_COMPANY", message: `Hedef şirket veritabanı adı geçersiz: "${plan.companyDb}"` });
  }

  const { debit, credit } = totals(plan.lines);
  if (debit !== credit) {
    violations.push({ code: "BALANCE", message: `Borç (${debit}) ve alacak (${credit}) kuruş toplamları eşit değil.` });
  }

  for (const line of plan.lines) {
    checkLine(plan, line, maxBytes, violations);
  }

  checkDates(plan, violations);

  if (plan.kind === "FAT") {
    const closing = plan.lines.find((line) => line.side === "C" && rootAccount(line.account) !== "951");
    if (closing && closing.amount >= NFT_THRESHOLD && cashRoots.includes(rootAccount(closing.account))) {
      violations.push({
        code: "FAT_30K_NOT_CASH",
        message: "30.000 TL ve üzeri alış faturası kasaya kapatılamaz; cari (320) kullanılmalı.",
        seq: closing.seq,
      });
    }
  }
  if (plan.kind === "DEK") {
    for (const line of plan.lines) {
      if (/N\.FT\s+İLE/i.test(line.description)) {
        violations.push({ code: "BANK_NO_FAT_RULES", message: "Banka fişine fatura açıklaması (N.FT İLE) yazılamaz.", seq: line.seq });
      }
    }
  }
  return violations;
}

function checkLine(plan: VoucherPlan, line: PlanLine, maxBytes: number, violations: Violation[]) {
  const seq = line.seq;
  if (line.account.trim().length === 0) {
    violations.push({ code: "ACCOUNT_MISSING", message: "Satırın hesap kodu boş.", seq });
  } else if (rootAccount(line.account) === "296") {
    violations.push({ code: "NO_296", message: "296 hesabı kullanılamaz; eşleşmeyen için 100 01.", seq });
  }
  if (!Number.isInteger(line.amount) || line.amount <= 0) {
    violations.push({ code: "POSITIVE_AMOUNTS", message: "Satır tutarı sıfırdan büyük tam kuruş olmalı.", seq });
  }
  const texts = [line.description, line.detail?.reference, line.detail?.item, line.detail?.unit, plan.headerNote];
  for (const text of texts) {
    if (text === undefined) continue;
    if (!isCp1254Safe(text)) {
      violations.push({ code: "CP1254_SAFE", message: `Metin Windows-1254'e kayıpsız çevrilemiyor: "${text}"`, seq });
    }
    const upper = text.toLocaleUpperCase("tr-TR");
    if (ASCII_TURKISH.some((pattern) => pattern.test(upper))) {
      violations.push({ code: "NO_ASCII_TURKISH", message: `ASCII'leştirilmiş Türkçe yazım: "${text}"`, seq });
    }
  }
  if (/\bALIM\b/.test(line.description.toLocaleUpperCase("tr-TR"))) {
    violations.push({ code: "NO_ALIM_TEXT", message: "Satır açıklamasına 'ALIM' yazılamaz.", seq });
  }
  if (line.description.trim().length === 0) {
    violations.push({ code: "DESCRIPTION_MISSING", message: "Satır açıklaması boş.", seq });
  } else if (cp1254ByteLength(line.description) > maxBytes) {
    violations.push({ code: "DESC_MAX_LEN", message: `Açıklama ${maxBytes} baytı aşıyor.`, seq });
  }
  if (line.docNo.trim().length === 0) {
    violations.push({ code: "DOC_NO_SET", message: "Evrak numarası boş.", seq });
  }
  for (const [field, value] of [["lineDate", line.lineDate], ["docDate", line.docDate]] as const) {
    if (!ISO_DATE.test(value) || value.startsWith("1900-")) {
      violations.push({ code: "DOC_DATE_SET", message: `${field} boş veya 1900 olamaz: "${value}"`, seq });
    }
  }
}

function checkDates(plan: VoucherPlan, violations: Violation[]) {
  for (let i = 1; i < plan.lines.length; i++) {
    const previous = plan.lines[i - 1];
    const current = plan.lines[i];
    if (previous && current && current.lineDate < previous.lineDate) {
      violations.push({ code: "LINE_DATES_CHRONO", message: "Satırlar tarih sırasında değil.", seq: current.seq });
      break;
    }
  }
  if (plan.mode === "monthly-single") {
    const [year, month] = plan.headerDate.split("-").map(Number);
    if (!year || !month || plan.headerDate !== lastDayOfMonth(year, month)) {
      violations.push({ code: "HEADER_DATE_RULE", message: "Tek mahsup fişinin başlık tarihi ayın son günü olmalı." });
    }
    const distinct = new Set(plan.lines.map((line) => line.lineDate));
    if (plan.lines.length > 2 && distinct.size === 1 && distinct.has(plan.headerDate)) {
      violations.push({ code: "HEADER_DATE_RULE", message: "Tüm satırlara ayın son günü basılmış; satırlar kendi tarihinde olmalı." });
    }
  } else if (plan.lines.some((line) => line.lineDate !== plan.headerDate)) {
    violations.push({ code: "HEADER_DATE_RULE", message: "Münferit fatura fişinde başlık ve satır tarihi fatura tarihi olmalı." });
  }
}
