import type { IsoDateTime } from "./datetime.ts";
import type { Kurus } from "./money.ts";

export type { IsoDateTime };
/** @deprecated Use IsoDateTime; date-only strings remain valid. */
export type IsoDate = IsoDateTime;

/** D = borç (MUHHARBATIPI 1), C = alacak (MUHHARBATIPI 2). */
export type Side = "D" | "C";

export interface LineDetail {
  /** MUHHARACIKLAMA1, e.g. "(320 A=014)". */
  reference?: string;
  /** MUHHARACIKLAMA2, item or service name. */
  item?: string;
  /** MUHHARACIKLAMA3, unit such as ADET, KG, LİTRE. */
  unit?: string;
  /** MUHHARMIKTUT. */
  quantity?: number;
}

export interface PlanLine {
  seq: number;
  account: string;
  side: Side;
  amount: Kurus;
  description: string;
  specialCode?: string;
  docNo: string;
  /** MUHHARTAR: original transaction date/time. On monthly-single this is never the header date unless the transaction fell on that day. */
  lineDate: IsoDateTime;
  /** MUHHAREVRAKTAR: same original date/time as the source document. */
  docDate: IsoDateTime;
  detail?: LineDetail;
  /** Which rule produced the line, for the preview and the audit trail. */
  ruleId: string;
}

export type VoucherKind = "FAT" | "DEK";

export type VoucherMode = "single-invoice" | "monthly-single";

export interface Blocker {
  code: string;
  message: string;
}

export interface VoucherPlan {
  /** Target company database, e.g. "ETA_S29_2026". A plan never spans companies. */
  companyDb: string;
  kind: VoucherKind;
  mode: VoucherMode;
  /** MUHFISTAR. monthly-single: last calendar day of the month. single-invoice: the invoice date. */
  headerDate: IsoDateTime;
  /** MUHFISOZELKOD1, e.g. "ALF" for purchase invoices. */
  specialCode1?: string;
  /** MUHFISEKCHAR2 / header note shown in ETA. */
  headerNote?: string;
  lines: PlanLine[];
  blockers: Blocker[];
}

export function totals(lines: readonly PlanLine[]): { debit: Kurus; credit: Kurus } {
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (line.side === "D") debit += line.amount;
    else credit += line.amount;
  }
  return { debit, credit };
}
