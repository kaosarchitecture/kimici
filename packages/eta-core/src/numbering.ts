export interface RefSnapshot {
  maxMuhfisRef: number;
  maxMuhharRef: number;
  maxCancelledRef: number;
}

/** Next REF must clear live headers, live lines and the cancel archive (DENK rules 02 and 19 combined). */
export function nextRef(snapshot: RefSnapshot): number {
  return Math.max(snapshot.maxMuhfisRef, snapshot.maxMuhharRef, snapshot.maxCancelledRef, 0) + 1;
}

const VOUCHER_NO = /^MA-(\d+)$/;

export function parseVoucherNo(value: string): number | null {
  const match = VOUCHER_NO.exec(value.trim());
  return match?.[1] ? Number(match[1]) : null;
}

export function formatVoucherNo(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence <= 0 || sequence > 999_999) {
    throw new Error(`Fiş numarası aralık dışında: ${sequence}`);
  }
  return `MA-${String(sequence).padStart(6, "0")}`;
}

export interface VoucherNoSnapshot {
  maxLiveSequence: number;
  maxCancelledSequence: number;
}

export function nextVoucherNo(snapshot: VoucherNoSnapshot): string {
  return formatVoucherNo(Math.max(snapshot.maxLiveSequence, snapshot.maxCancelledSequence, 0) + 1);
}
