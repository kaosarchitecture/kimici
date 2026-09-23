/** Amounts are integer kuruş (1 TL = 100 kuruş) everywhere in the core to avoid float drift. */
export type Kurus = number;

const TR_AMOUNT = /^-?\d+(?:\.\d{1,2})?$/;

/**
 * Parses a Turkish formatted amount ("30.150,00", "-8,37") into kuruş.
 * Dots are thousand separators, comma is the decimal separator, the unit is TL.
 * Never strips all separators and never divides by 100 (DENK rule 12).
 */
export function parseTrAmount(text: string): Kurus {
  const compact = text.trim().replace(/\s+/g, "");
  if (compact.length === 0) {
    throw new Error(`Tutar boş: "${text}"`);
  }
  const commaCount = compact.split(",").length - 1;
  if (commaCount > 1) {
    throw new Error(`Tutar biçimi tanınmadı: "${text}"`);
  }
  if (commaCount === 0 && compact.includes(".")) {
    throw new Error(`Tutar biçimi tanınmadı: "${text}"`);
  }
  const normalized = compact.replace(/\./g, "").replace(",", ".");
  if (!TR_AMOUNT.test(normalized)) {
    throw new Error(`Tutar biçimi tanınmadı: "${text}"`);
  }
  return decimalStringToKurus(normalized);
}

/** Converts an already numeric cell value (Excel Value2, in TL) into kuruş. */
export function tlToKurus(value: number): Kurus {
  if (!Number.isFinite(value)) {
    throw new Error(`Geçersiz tutar: ${value}`);
  }
  return Math.round(value * 100 + (value >= 0 ? 1e-9 : -1e-9));
}

export function decimalStringToKurus(value: string): Kurus {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [intPart = "0", fracPart = ""] = unsigned.split(".");
  const kurus = Number(intPart) * 100 + Number(fracPart.padEnd(2, "0").slice(0, 2));
  return negative ? -kurus : kurus;
}

/** SQL-safe decimal literal, e.g. 3549638 -> "35496.38". */
export function kurusToDecimalString(kurus: Kurus): string {
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Display format used in ETA reports and logs, e.g. "79.106,22". */
export function formatTr(kurus: Kurus): string {
  const sign = kurus < 0 ? "-" : "";
  const abs = Math.abs(kurus);
  const lira = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${lira},${String(abs % 100).padStart(2, "0")}`;
}

/** Half-up percentage of a non-negative kuruş amount, computed in integers. */
export function percentOf(kurus: Kurus, percent: number): Kurus {
  if (kurus < 0) {
    throw new Error("percentOf yalnızca pozitif tutarlarla çalışır");
  }
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
    throw new Error(`Geçersiz yüzde: ${percent}`);
  }
  return Math.floor((kurus * percent * 2 + 100) / 200);
}
