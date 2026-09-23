import { filterRecords, sanitizeFields } from "./filter.ts";
import {
  type ConsentGrant,
  type ConsentRequest,
  type HubSnapshot,
  type HubStatus,
  type ScopeId,
  type ViewField,
  type ViewPayload,
  type WindowsIdentity,
  SCOPES,
} from "./types.ts";
import { attestWindowsIdentity } from "./windows.ts";

export interface RequestViewInput {
  purpose: string;
  scopes?: readonly ScopeId[];
  fields: readonly ViewField[];
  ttlMs?: number;
  now?: Date;
}

export interface GrantInput {
  identity: WindowsIdentity;
  fields?: readonly ViewField[];
  now?: Date;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

export class ConsentHub {
  private status: HubStatus = "idle";
  private request: ConsentRequest | null = null;
  private currentGrant: ConsentGrant | null = null;
  private view: ViewPayload | null = null;
  private denyReason: string | null = null;

  snapshot(now = new Date()): HubSnapshot {
    this.expireIfNeeded(now);
    return {
      status: this.status,
      request: this.request,
      grant: this.currentGrant,
      view: this.view,
      denyReason: this.denyReason,
    };
  }

  /** AI on our server asks the already-connected agent for a scoped view. */
  requestView(input: RequestViewInput): ConsentRequest {
    const now = input.now ?? new Date();
    const fields = sanitizeFields(input.fields);
    if (!input.purpose.trim()) throw new Error("İstek gerekçesi boş olamaz.");
    if (fields.length === 0) throw new Error("En az bir izinli alan seçilmeli.");
    const scopes = (input.scopes ?? ["plan.preview"]).filter((scope): scope is ScopeId =>
      (SCOPES as readonly string[]).includes(scope),
    );
    if (scopes.length === 0) throw new Error("Geçerli kapsam yok.");

    this.request = {
      requestId: id("req"),
      purpose: input.purpose.trim(),
      scopes,
      fields,
      createdAt: iso(now),
      expiresAt: iso(new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS))),
    };
    this.currentGrant = null;
    this.view = null;
    this.denyReason = null;
    this.status = "pending";
    return this.request;
  }

  /** Agent received the request and showed the local Windows consent dialog. */
  markPrompted(requestId: string, identity: WindowsIdentity, now = new Date()): void {
    this.requireRequest(requestId, now);
    attestWindowsIdentity(identity);
    this.status = "prompted";
  }

  grant(requestId: string, input: GrantInput): ConsentGrant {
    const now = input.now ?? new Date();
    this.requireRequest(requestId, now);
    if (this.status !== "pending" && this.status !== "prompted") {
      throw new Error("Bu istek onaylanamaz.");
    }
    const identity = attestWindowsIdentity(input.identity);
    const requested = this.request!.fields;
    const chosen = sanitizeFields(input.fields ?? requested).filter((field) => requested.includes(field));
    if (chosen.length === 0) throw new Error("Kullanıcı hiçbir alanı onaylamadı.");

    this.currentGrant = {
      grantId: id("grn"),
      requestId,
      identity,
      scopes: this.request!.scopes,
      fields: chosen,
      createdAt: iso(now),
      expiresAt: this.request!.expiresAt,
    };
    this.status = "granted";
    this.denyReason = null;
    this.view = null;
    return this.currentGrant;
  }

  deny(requestId: string, reason: string, now = new Date()): void {
    this.requireRequest(requestId, now);
    this.status = "denied";
    this.denyReason = reason.trim() || "Kullanıcı reddetti.";
    this.currentGrant = null;
    this.view = null;
  }

  /**
   * Agent pushes local records. Hub keeps only grant-approved fields.
   * This is inbound from the agent — the hub never fetches the user machine.
   */
  pushView(grantId: string, records: readonly Record<string, unknown>[], now = new Date()): ViewPayload {
    this.expireIfNeeded(now);
    if (!this.currentGrant || this.currentGrant.grantId !== grantId) {
      throw new Error("Geçerli Windows onayı yok.");
    }
    if (this.status !== "granted" && this.status !== "ready") {
      throw new Error("Görünüm bu durumda kabul edilmez.");
    }
    const view: ViewPayload = {
      requestId: this.currentGrant.requestId,
      grantId,
      records: filterRecords(records, this.currentGrant.fields),
      fieldSet: [...this.currentGrant.fields],
      pushedAt: iso(now),
    };
    this.view = view;
    this.status = "ready";
    return view;
  }

  revoke(grantId: string): void {
    if (!this.currentGrant || this.currentGrant.grantId !== grantId) {
      throw new Error("Geri alınacak onay yok.");
    }
    this.status = "revoked";
    this.view = null;
    this.currentGrant = null;
  }

  private requireRequest(requestId: string, now: Date): ConsentRequest {
    this.expireIfNeeded(now);
    if (!this.request || this.request.requestId !== requestId) {
      throw new Error("İstek bulunamadı.");
    }
    if (this.status === "expired") throw new Error("İstek süresi doldu.");
    return this.request;
  }

  private expireIfNeeded(now: Date): void {
    const deadline = this.request?.expiresAt ?? this.currentGrant?.expiresAt;
    if (!deadline) return;
    if (now.getTime() <= Date.parse(deadline)) return;
    if (this.status === "ready" || this.status === "granted" || this.status === "pending" || this.status === "prompted") {
      this.status = "expired";
      this.view = null;
    }
  }
}
