/** Field the agent may push after Windows consent. Unknown keys are dropped. */
export const VIEW_FIELDS = [
  "account",
  "side",
  "amountText",
  "description",
  "lineDate",
  "ruleId",
] as const;

export type ViewField = (typeof VIEW_FIELDS)[number];

export const SCOPES = ["plan.preview"] as const;
export type ScopeId = (typeof SCOPES)[number];

export const SCOPE_LABELS: Record<ScopeId, string> = {
  "plan.preview": "Fiş planı önizlemesi",
};

/** Local Windows identity. Password is never part of this object. */
export interface WindowsIdentity {
  account: string;
  sid: string;
  interactive: boolean;
  attestedAt: string;
}

export interface ConsentRequest {
  requestId: string;
  purpose: string;
  scopes: readonly ScopeId[];
  fields: readonly ViewField[];
  createdAt: string;
  expiresAt: string;
}

export interface ConsentGrant {
  grantId: string;
  requestId: string;
  identity: WindowsIdentity;
  scopes: readonly ScopeId[];
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

export type HubStatus =
  | "idle"
  | "pending"
  | "prompted"
  | "denied"
  | "granted"
  | "ready"
  | "revoked"
  | "expired";

export interface HubSnapshot {
  status: HubStatus;
  request: ConsentRequest | null;
  grant: ConsentGrant | null;
  view: ViewPayload | null;
  denyReason: string | null;
}

export interface Envelope<T extends string, B> {
  v: 1;
  type: T;
  id: string;
  ts: string;
  body: B;
}

export type ConsentMessage =
  | Envelope<"consent.request", ConsentRequest>
  | Envelope<"consent.prompted", { requestId: string; identity: WindowsIdentity }>
  | Envelope<"consent.granted", ConsentGrant>
  | Envelope<"consent.denied", { requestId: string; reason: string }>
  | Envelope<"consent.revoked", { grantId: string }>
  | Envelope<"view.chunk", ViewPayload>
  | Envelope<"view.ready", { requestId: string; grantId: string; recordCount: number }>;
