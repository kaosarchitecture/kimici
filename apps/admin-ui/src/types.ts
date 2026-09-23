export const VIEW_FIELDS = [
  "account",
  "side",
  "amountText",
  "description",
  "lineDate",
  "ruleId",
] as const;

export type ViewField = (typeof VIEW_FIELDS)[number];

export type HubStatus =
  | "idle"
  | "pending"
  | "prompted"
  | "denied"
  | "granted"
  | "ready"
  | "revoked"
  | "expired";

export interface WindowsIdentity {
  account: string;
  sid: string;
  interactive: boolean;
  attestedAt: string;
}

export interface ConsentRequest {
  requestId: string;
  purpose: string;
  scopes: readonly string[];
  fields: readonly ViewField[];
  createdAt: string;
  expiresAt: string;
}

export interface ConsentGrant {
  grantId: string;
  requestId: string;
  identity: WindowsIdentity;
  scopes: readonly string[];
  fields: readonly ViewField[];
  createdAt: string;
  expiresAt: string;
}

export type ViewRecord = Partial<Record<ViewField, string>>;

export interface ViewPayload {
  requestId: string;
  grantId: string;
  records: ViewRecord[];
  fieldSet: ViewField[];
  pushedAt: string;
}

export interface HubSnapshot {
  status: HubStatus;
  request: ConsentRequest | null;
  grant: ConsentGrant | null;
  view: ViewPayload | null;
  denyReason: string | null;
}
