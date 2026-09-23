import { describe, expect, it } from "vitest";
import { ConsentHub } from "../src/hub.ts";
import { BOOKS_GONE, routeControlPlane } from "../src/http.ts";
import { TenantBook } from "../src/registry.ts";

const LIVE = {
  account: "OFIS\\Ayse",
  sid: "S-1-5-21-100-200-300-1001",
  interactive: true,
  attestedAt: "2026-09-23T12:00:00Z",
};

function world() {
  return { hubs: new Map<string, ConsentHub>(), book: new TenantBook() };
}

async function api(
  ctx: ReturnType<typeof world>,
  method: string,
  path: string,
  init?: { tenant?: string; operator?: string; device?: string; body?: unknown },
): Promise<Response> {
  const url = new URL(path, "https://hub.example");
  const headers = new Headers({ "content-type": "application/json" });
  if (init?.tenant) headers.set("X-Denk-Tenant", init.tenant);
  if (init?.operator) headers.set("X-Denk-Operator", init.operator);
  if (init?.device) headers.set("X-Denk-Device", init.device);
  const request = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(init?.body ?? {}),
  });
  const res = await routeControlPlane(request, {
    book: ctx.book,
    resolveHub: async (tenant) => {
      const existing = ctx.hubs.get(tenant);
      if (existing) return existing;
      const hub = new ConsentHub();
      ctx.hubs.set(tenant, hub);
      return hub;
    },
  });
  if (!res) throw new Error(`unhandled ${path}`);
  return res;
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function openOffice(ctx: ReturnType<typeof world>) {
  const created = (await json(await api(ctx, "POST", "/api/tenants"))) as {
    tenant: string;
    enrollCode: string;
    operatorKey: string;
  };
  const enrolled = (await json(
    await api(ctx, "POST", "/api/enroll", { body: { enrollCode: created.enrollCode } }),
  )) as { tenant: string; deviceKey: string };
  return { ...created, deviceKey: enrolled.deviceKey };
}

describe("control plane HTTP", () => {
  it("serves a knowledge pack without a tenant or a book", async () => {
    const res = await routeControlPlane(new Request("https://hub.example/api/knowledge"));
    expect(res?.status).toBe(200);
    const body = await json(res!);
    const pack = body.pack as { vatDescription?: string; cashAccount?: string };
    expect(pack.vatDescription).toBe("İND.KDV.");
    expect(pack.cashAccount).toBe("100 01");
  });

  it("rejects the old evrak and AI book path", async () => {
    const evrak = await routeControlPlane(
      new Request("https://hub.example/api/evrak", { method: "POST", body: "{}" }),
    );
    const ai = await routeControlPlane(
      new Request("https://hub.example/api/ai", { method: "POST", body: "{}" }),
    );
    expect(evrak?.status).toBe(410);
    expect(ai?.status).toBe(410);
    expect((await json(evrak!)).error).toBe(BOOKS_GONE);
  });

  it("rejects hub calls without a device or operator key", async () => {
    const ctx = world();
    const office = await openOffice(ctx);
    const res = await api(ctx, "GET", "/api/state", { tenant: office.tenant });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toMatch(/Kimlik/);
  });

  it("rejects a second use of the enroll code", async () => {
    const ctx = world();
    const created = (await json(await api(ctx, "POST", "/api/tenants"))) as { enrollCode: string };
    const first = await api(ctx, "POST", "/api/enroll", { body: { enrollCode: created.enrollCode } });
    const second = await api(ctx, "POST", "/api/enroll", { body: { enrollCode: created.enrollCode } });
    expect(first.status).toBe(200);
    expect(second.status).toBe(400);
  });

  it("keeps two tenants apart and drops invoice fields", async () => {
    const ctx = world();
    const a = await openOffice(ctx);
    const b = await openOffice(ctx);

    const requestRes = await api(ctx, "POST", "/api/views/request", {
      tenant: a.tenant,
      operator: a.operatorKey,
      body: { purpose: "Ağustos alış", fields: ["account", "amountText", "description"] },
    });
    expect(requestRes.status).toBe(200);
    const pending = (await json(requestRes)) as { request: { requestId: string } };

    const stolen = await api(ctx, "POST", "/api/views/request", {
      tenant: a.tenant,
      operator: b.operatorKey,
      body: { purpose: "çalıntı", fields: ["account"] },
    });
    expect(stolen.status).toBe(401);

    await api(ctx, "POST", "/api/agent/grant", {
      tenant: a.tenant,
      device: a.deviceKey,
      body: { requestId: pending.request.requestId, identity: LIVE },
    });
    const grantState = await json(
      await api(ctx, "GET", "/api/state", { tenant: a.tenant, device: a.deviceKey }),
    );
    const grantId = (grantState.grant as { grantId: string }).grantId;
    await api(ctx, "POST", "/api/agent/push", {
      tenant: a.tenant,
      device: a.deviceKey,
      body: {
        grantId,
        records: [
          { account: "191 02 20", amountText: "20,00", description: "İND.KDV.", invoiceNo: "should-drop" },
          { account: "100 01", amountText: "120,00", description: "kasa" },
        ],
      },
    });

    const aState = await json(await api(ctx, "GET", "/api/state", { tenant: a.tenant, operator: a.operatorKey }));
    const bState = await json(await api(ctx, "GET", "/api/state", { tenant: b.tenant, operator: b.operatorKey }));
    expect(aState.status).toBe("ready");
    expect(bState.status).toBe("idle");
    expect(bState.view).toBeNull();
    const records = (aState.view as { records: Array<Record<string, string>> }).records;
    expect(records[0]).toEqual({ account: "191 02 20", amountText: "20,00", description: "İND.KDV." });
    expect(records[0]?.invoiceNo).toBeUndefined();
  });

  it("does not let an operator key grant or push", async () => {
    const ctx = world();
    const office = await openOffice(ctx);
    const pending = (await json(
      await api(ctx, "POST", "/api/views/request", {
        tenant: office.tenant,
        operator: office.operatorKey,
        body: { purpose: "deneme", fields: ["account"] },
      }),
    )) as { request: { requestId: string } };
    const res = await api(ctx, "POST", "/api/agent/grant", {
      tenant: office.tenant,
      operator: office.operatorKey,
      body: { requestId: pending.request.requestId, identity: LIVE },
    });
    expect(res.status).toBe(401);
  });

  it("rejects a DEMO Windows identity on the product path", async () => {
    const ctx = world();
    const office = await openOffice(ctx);
    const pending = (await json(
      await api(ctx, "POST", "/api/views/request", {
        tenant: office.tenant,
        operator: office.operatorKey,
        body: { purpose: "deneme", fields: ["account"] },
      }),
    )) as { request: { requestId: string } };
    const res = await api(ctx, "POST", "/api/agent/grant", {
      tenant: office.tenant,
      device: office.deviceKey,
      body: {
        requestId: pending.request.requestId,
        identity: {
          account: "DEMO\\Kullanici",
          sid: "S-1-5-21-DEMO-1001",
          interactive: true,
          attestedAt: "2026-09-23T12:00:00Z",
        },
      },
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/DEMO/);
  });
});
