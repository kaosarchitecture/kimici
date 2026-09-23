import { accountLevels, normalizeAccount, parentAccounts } from "./accounts.ts";
import type { Kurus } from "./money.ts";
import type { Side } from "./types.ts";

export interface MizanInputLine {
  account: string;
  side: Side;
  amount: Kurus;
}

export interface MizanValue {
  debit: Kurus;
  credit: Kurus;
}

/**
 * Month trial balance for MUHMIZDEGER: every leaf account plus all of its parents.
 * Input must be all MUHHAR lines of the month, not only the new voucher.
 */
export function rollupMizan(lines: Iterable<MizanInputLine>): Map<string, MizanValue> {
  const result = new Map<string, MizanValue>();
  const add = (code: string, side: Side, amount: Kurus) => {
    const current = result.get(code) ?? { debit: 0, credit: 0 };
    if (side === "D") current.debit += amount;
    else current.credit += amount;
    result.set(code, current);
  };
  for (const line of lines) {
    const leaf = normalizeAccount(line.account);
    add(leaf, line.side, line.amount);
    for (const parent of parentAccounts(leaf)) add(parent, line.side, line.amount);
  }
  return result;
}

/** Top level (3-digit) accounts must balance, same check the approved scripts ran before commit. */
export function topLevelDifference(mizan: Map<string, MizanValue>): Kurus {
  let debit = 0;
  let credit = 0;
  for (const [code, value] of mizan) {
    if (accountLevels(code).length === 1) {
      debit += value.debit;
      credit += value.credit;
    }
  }
  return debit - credit;
}
