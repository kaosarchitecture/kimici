const TENANT = /^[a-z0-9-]{2,64}$/;

export function parseTenantId(raw: string | null | undefined): string {
  const tenant = (raw ?? "").trim().toLowerCase();
  if (!TENANT.test(tenant)) {
    throw new Error("Kiracı kodu geçersiz. 2–64 karakter: a-z, 0-9, tire.");
  }
  return tenant;
}

export function tenantFromRequest(request: Request): string {
  const url = new URL(request.url);
  return parseTenantId(request.headers.get("X-Denk-Tenant") ?? url.searchParams.get("tenant"));
}
