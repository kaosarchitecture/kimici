/** Civil date "YYYY-MM-DD" or date-time "YYYY-MM-DDTHH:mm[:ss]". Time is the original wall clock, not UTC. */
export type IsoDateTime = string;

export interface CivilDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseCivil(value: string): CivilDateTime | null {
  const dateOnly = DATE_ONLY.exec(value.trim());
  if (dateOnly) {
    return partsToCivil(dateOnly[1], dateOnly[2], dateOnly[3], "00", "00", "00");
  }
  const withTime = DATE_TIME.exec(value.trim());
  if (withTime) {
    return partsToCivil(withTime[1], withTime[2], withTime[3], withTime[4], withTime[5], withTime[6] ?? "00");
  }
  return null;
}

export function isIsoDateTime(value: string): boolean {
  return parseCivil(value) !== null;
}

export function datePart(value: string): string {
  return value.trim().slice(0, 10);
}

export function formatCivil(parts: CivilDateTime, withTime: boolean): IsoDateTime {
  const date = `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}`;
  if (!withTime && parts.hour === 0 && parts.minute === 0 && parts.second === 0) return date;
  return `${date}T${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}`;
}

export function combineDateAndTime(date: string, time?: string): IsoDateTime {
  const parsedDate = parseCivil(date.includes("T") || date.includes(" ") ? date : `${datePart(date)}T00:00:00`);
  if (!parsedDate) {
    throw new Error(`Tarih biçimi tanınmadı: "${date}"`);
  }
  if (!time || date.includes("T") || / \d{2}:\d{2}/.test(date)) {
    return formatCivil(parsedDate, parsedDate.hour !== 0 || parsedDate.minute !== 0 || parsedDate.second !== 0);
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) {
    throw new Error(`Saat biçimi tanınmadı: "${time}"`);
  }
  return formatCivil({
    ...parsedDate,
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? "0"),
  }, true);
}

export function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function monthPrefix(year: number, month: number): string {
  return `${year}-${pad(month, 2)}-`;
}

/** SQL datetime with the civil wall clock as the stored numbers (no timezone conversion). */
export function toNaiveSqlDate(value: string): Date {
  const parts = parseCivil(value);
  if (!parts) return new Date(Date.UTC(1900, 0, 1));
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

export function compareCivil(left: string, right: string): number {
  const a = parseCivil(left);
  const b = parseCivil(right);
  if (!a || !b) return left < right ? -1 : left > right ? 1 : 0;
  return (
    a.year - b.year ||
    a.month - b.month ||
    a.day - b.day ||
    a.hour - b.hour ||
    a.minute - b.minute ||
    a.second - b.second
  );
}

function partsToCivil(
  year: string | undefined,
  month: string | undefined,
  day: string | undefined,
  hour: string | undefined,
  minute: string | undefined,
  second: string | undefined,
): CivilDateTime | null {
  if (!year || !month || !day || !hour || !minute || !second) return null;
  const parts: CivilDateTime = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  if (parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > 31) return null;
  if (parts.hour > 23 || parts.minute > 59 || parts.second > 59) return null;
  return parts;
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}
