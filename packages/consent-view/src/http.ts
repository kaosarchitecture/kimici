import { buildKnowledgePack } from "./knowledge.ts";
import { ConsentHub } from "./hub.ts";
import { tenantFromRequest } from "./tenant.ts";
import { assertLiveWindowsIdentity } from "./windows.ts";
import { sanitizeFields } from "./filter.ts";
import { SCOPES, type ScopeId, type WindowsIdentity } from "./types.ts";

export const BOOKS_GONE =
  "Evrak ve fiş bu sunucuda durmaz. İş müşteri Windows’unda; web yalnız ajanın ittiği izinli görünümü gösterir.";

export const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type, x-denk-tenant",
};

const HUB_PATHS = new Set([
  "/api/state",
  "/api/views/request",
  "/api/views/revoke",
  "/api/agent/prompted",
  "/api/agent/grant",
  "/api/agent/deny",
  "/api/agent/push",
]);

export function isHubPath(pathname: string): boolean {
  return HUB_PATHS.has(pathname);
}

export function isControlPlanePath(pathname: string): boolean {
  return pathname === "/api/knowledge" || pathname === "/api/evrak" || pathname === "/api/ai" || isHubPath(pathname);
}

export function json(data: unknown, status = 200): Response {
  if (status === 204) return new Response(null, { status, headers: CORS });
  return Response.json(data, { status, headers: CORS });
}

function fail(error: unknown, fallback = 400): Response {
  const message = error instanceof Error ? error.message : "İstek işlenemedi.";
  return json({ error: message }, fallback);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "OPTIONS") return {};
  const text = await request.text();
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gövde nesne olmalı.");
  }
  return parsed as Record<string, unknown>;
}

function asIdentity(value: unknown): WindowsIdentity {
  if (!value || typeof value !== "object") throw new Error("Windows kimliği yok.");
  const row = value as Record<string, unknown>;
  return assertLiveWindowsIdentity({
    account: String(row.account ?? ""),
    sid: String(row.sid ?? ""),
    interactive: row.interactive === true,
    attestedAt: String(row.attestedAt ?? ""),
  });
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} gerekli.`);
  return value.trim();
}

/**
 * Knowledge + per-tenant consent view. Never stores an invoice or voucher book.
 * Returns null when the path is not a control-plane API (Worker then serves assets).
 */
export async function routeControlPlane(
  request: Request,
  resolveHub?: (tenant: string) => ConsentHub | Promise<ConsentHub>,
): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    return json(null, 204);
  }

  if (pathname === "/api/knowledge") {
    if (request.method !== "GET") return json({ error: "izin yok" }, 405);
    return json({ pack: buildKnowledgePack(), where: "bilgi paketi · müşteri defteri yok" });
  }

  if (pathname === "/api/evrak" || pathname === "/api/ai") {
    return json({ error: BOOKS_GONE }, 410);
  }

  if (!isHubPath(pathname)) return null;
  if (!resolveHub) return json({ error: "Kiracı merkezi yok." }, 500);

  let tenant: string;
  try {
    tenant = tenantFromRequest(request);
  } catch (error) {
    return fail(error);
  }

  try {
    const hub = await resolveHub(tenant);
    const body = await readJson(request);

    if (pathname === "/api/state") {
      if (request.method !== "GET") return json({ error: "izin yok" }, 405);
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/views/request") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      const fields = sanitizeFields(Array.isArray(body.fields) ? body.fields.map(String) : []);
      const scopes = Array.isArray(body.scopes)
        ? body.scopes.filter((scope): scope is ScopeId => (SCOPES as readonly string[]).includes(String(scope)))
        : undefined;
      hub.requestView({
        purpose: asString(body.purpose, "Gerekçe"),
        fields,
        ...(scopes ? { scopes } : {}),
        ...(typeof body.ttlMs === "number" ? { ttlMs: body.ttlMs } : {}),
      });
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/views/revoke") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      hub.revoke(asString(body.grantId, "Onay"));
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/agent/prompted") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      hub.markPrompted(asString(body.requestId, "İstek"), asIdentity(body.identity));
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/agent/grant") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      const fields = Array.isArray(body.fields) ? sanitizeFields(body.fields.map(String)) : undefined;
      hub.grant(asString(body.requestId, "İstek"), {
        identity: asIdentity(body.identity),
        ...(fields ? { fields } : {}),
      });
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/agent/deny") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      hub.deny(asString(body.requestId, "İstek"), typeof body.reason === "string" ? body.reason : "Kullanıcı reddetti.");
      return json({ tenant, ...hub.snapshot() });
    }

    if (pathname === "/api/agent/push") {
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      const records = Array.isArray(body.records) ? body.records : [];
      if (records.some((row) => !row || typeof row !== "object" || Array.isArray(row))) {
        throw new Error("Satırlar nesne olmalı.");
      }
      hub.pushView(asString(body.grantId, "Onay"), records as Record<string, unknown>[]);
      return json({ tenant, ...hub.snapshot() });
    }

    return json({ error: "izin yok" }, 405);
  } catch (error) {
    return fail(error);
  }
}
