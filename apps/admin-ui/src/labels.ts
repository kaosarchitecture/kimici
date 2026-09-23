import type { HubStatus, ViewField } from "./types.ts";

export const FIELD_LABELS: Record<ViewField, string> = {
  account: "Hesap",
  side: "B/A",
  amountText: "Tutar",
  description: "Açıklama",
  lineDate: "Satır tarihi",
  ruleId: "Kural",
};

export const STATUS_LABELS: Record<HubStatus, string> = {
  idle: "Beklemede",
  pending: "İzin yolda",
  prompted: "Windows onayı açık",
  denied: "Reddedildi",
  granted: "Onaylandı",
  ready: "İzinli fiş geldi",
  revoked: "Görünüm kapalı",
  expired: "Süre doldu",
};

export function formatClock(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
