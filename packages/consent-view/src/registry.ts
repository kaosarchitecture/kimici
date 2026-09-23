import { parseTenantId } from "./tenant.ts";

export type TenantStatus = "pending" | "enrolled" | "revoked";
export type AuthRole = "operator" | "device";

export interface TenantRecord {
  tenant: string;
  status: TenantStatus;
  createdAt: string;
  enrollCodeHash: string | null;
  enrollExpiresAt: string | null;
  operatorKeyHash: string;
  deviceKeyHash: string | null;
}

export interface RegistrySnapshot {
  tenants: TenantRecord[];
}

const ENROLL_TTL_MS = 24 * 60 * 60 * 1000;

function token(prefix: string, bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return prefix + [...raw].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function sameHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export class TenantBook {
  private tenants = new Map<string, TenantRecord>();

  snapshot(): RegistrySnapshot {
    return { tenants: [...this.tenants.values()] };
  }

  restore(snapshot: RegistrySnapshot): void {
    this.tenants.clear();
    for (const row of snapshot.tenants) this.tenants.set(row.tenant, row);
  }

  async create(now = new Date()): Promise<{ tenant: string; enrollCode: string; operatorKey: string }> {
    const tenant = parseTenantId(`b${token("", 8)}`);
    const enrollCode = token("dnk_", 16);
    const operatorKey = token("opr_", 24);
    this.tenants.set(tenant, {
      tenant,
      status: "pending",
      createdAt: now.toISOString(),
      enrollCodeHash: await sha256Hex(enrollCode),
      enrollExpiresAt: new Date(now.getTime() + ENROLL_TTL_MS).toISOString(),
      operatorKeyHash: await sha256Hex(operatorKey),
      deviceKeyHash: null,
    });
    return { tenant, enrollCode, operatorKey };
  }

  async enroll(enrollCode: string, now = new Date()): Promise<{ tenant: string; deviceKey: string }> {
    const hash = await sha256Hex(enrollCode.trim());
    let match: TenantRecord | undefined;
    for (const row of this.tenants.values()) {
      if (row.enrollCodeHash && sameHex(row.enrollCodeHash, hash)) {
        match = row;
        break;
      }
    }
    if (!match) throw new Error("Kayıt kodu geçersiz.");
    if (match.status === "revoked") throw new Error("Kiracı askıda.");
    if (match.deviceKeyHash) throw new Error("Kayıt kodu kullanılmış.");
    if (!match.enrollExpiresAt || now.getTime() > Date.parse(match.enrollExpiresAt)) {
      throw new Error("Kayıt kodunun süresi doldu.");
    }
    const deviceKey = token("dvc_", 24);
    match.deviceKeyHash = await sha256Hex(deviceKey);
    match.enrollCodeHash = null;
    match.enrollExpiresAt = null;
    match.status = "enrolled";
    return { tenant: match.tenant, deviceKey };
  }

  async authorize(tenant: string, keys: { operator?: string; device?: string }): Promise<AuthRole> {
    const row = this.tenants.get(tenant);
    if (!row || row.status === "revoked") throw new Error("Kimlik geçersiz.");
    if (keys.operator) {
      if (sameHex(row.operatorKeyHash, await sha256Hex(keys.operator))) return "operator";
    }
    if (keys.device) {
      if (row.deviceKeyHash && sameHex(row.deviceKeyHash, await sha256Hex(keys.device))) return "device";
    }
    throw new Error("Kimlik geçersiz.");
  }
}

export function keysFromRequest(request: Request): { operator?: string; device?: string } {
  const operator = request.headers.get("X-Denk-Operator")?.trim() ?? "";
  const device = request.headers.get("X-Denk-Device")?.trim() ?? "";
  return {
    ...(operator ? { operator } : {}),
    ...(device ? { device } : {}),
  };
}
