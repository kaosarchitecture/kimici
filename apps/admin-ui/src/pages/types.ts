export type ViewField = "account" | "side" | "amountText" | "description" | "lineDate" | "ruleId";

export const VIEW_FIELDS: ViewField[] = [
  "account",
  "side",
  "amountText",
  "description",
  "lineDate",
  "ruleId",
];

export const FIELD_LABELS: Record<ViewField, string> = {
  account: "Hesap",
  side: "B/A",
  amountText: "Tutar",
  description: "Açıklama",
  lineDate: "Satır tarihi",
  ruleId: "Kural",
};

export type HubStatus =
  | "idle"
  | "pending"
  | "prompted"
  | "denied"
  | "granted"
  | "ready"
  | "revoked"
  | "expired";

export const STATUS_LABELS: Record<HubStatus, string> = {
  idle: "Ajan henüz satır itmedi",
  pending: "Windows onayı bekleniyor",
  prompted: "Windows onay penceresi açık",
  denied: "Kullanıcı reddetti",
  granted: "Onaylandı, satır bekleniyor",
  ready: "İzinli görünüm hazır",
  revoked: "Görünüm kapatıldı",
  expired: "Süre doldu",
};

export interface ViewRecord {
  account?: string;
  side?: string;
  amountText?: string;
  description?: string;
  lineDate?: string;
  ruleId?: string;
}

export interface ViewPayload {
  requestId: string;
  grantId: string;
  records: ViewRecord[];
  fieldSet: ViewField[];
  pushedAt: string;
}

export interface HubState {
  tenant: string;
  status: HubStatus;
  request: {
    requestId: string;
    purpose: string;
    fields: ViewField[];
    expiresAt: string;
  } | null;
  grant: {
    grantId: string;
    identity: { account: string; sid: string };
    fields: ViewField[];
    expiresAt: string;
  } | null;
  view: ViewPayload | null;
  denyReason: string | null;
}

export const TENANT_KEY = "denk-tenant";
export const OPERATOR_KEY = "denk-operator";
