import { describe, expect, it } from "vitest";
import { ConsentHub } from "../src/hub.ts";
import { BOOKS_GONE, routeControlPlane } from "../src/http.ts";

const LIVE = {
  account: "OFIS\\Ayse",
  sid: "S-1-5-21-100-200-300-1001",
  interactive: true,
  attestedAt: "2026-09-23T12:00:00Z",
};

function hubs(): Map<string, ConsentHub> {
  return new Map();
}

async function api(
  store: Map<string, ConsentHub>,
  method: string,
  path: string,
  init?: { tenant?: string; body?: unknown },
): Promise<Response> {
  const url = new URL(path, "https://hub.example");
  const headers = new Headers({ "content-type": "application/json" });
  if (init?.tenant) headers.set("X-Denk-Tenant", init.tenant);
  const request = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(init?.body ?? {}),
  });
  const res = await routeControlPlane(request, async (tenant) => {
    const existing = store.get(tenant);
    if (existing) return existing;
    const hub = new ConsentHub();
    store.set(tenant, hub);
    return hub;
  });
  if (!res) throw new Error(`unhandled ${path}`);
  return res;
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
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

  it("requires a tenant before any view is stored", async () => {
    const store = hubs();
    const res = await api(store, "GET", "/api/state");
    expect(res.status).toBe(400);
    expect((await json(res)).error).toMatch(/Kiracı/);
  });

  it("keeps two tenants apart — second office cannot see the first view", async () => {
    const store = hubs();
    const requestRes = await api(store, "POST", "/api/views/request", {
      tenant: "buro-a",
      body: { purpose: "Ağustos alış", fields: ["account", "amountText", "description"] },
    });
    expect(requestRes.status).toBe(200);
    const pending = (await json(requestRes)) as { request: { requestId: string } };
    await api(store, "POST", "/api/agent/grant", {
      tenant: "buro-a",
      body: { requestId: pending.request.requestId, identity: LIVE },
    });
    const grantState = await json(await api(store, "GET", "/api/state", { tenant: "buro-a" }));
    const grantId = (grantState.grant as { grantId: string }).grantId;
    await api(store, "POST", "/api/agent/push", {
      tenant: "buro-a",
      body: {
        grantId,
        records: [
          { account: "191 02 20", amountText: "20,00", description: "İND.KDV.", invoiceNo: "should-drop" },
          { account: "100 01", amountText: "120,00", description: "kasa" },
        ],
      },
    });

    const a = await json(await api(store, "GET", "/api/state", { tenant: "buro-a" }));
    const b = await json(await api(store, "GET", "/api/state", { tenant: "buro-b" }));
    expect(a.status).toBe("ready");
    expect(b.status).toBe("idle");
    expect(b.view).toBeNull();
    const records = (a.view as { records: Array<Record<string, string>> }).records;
    expect(records[0]).toEqual({ account: "191 02 20", amountText: "20,00", description: "İND.KDV." });
    expect(records[0]?.invoiceNo).toBeUndefined();
  });

  it("rejects a DEMO Windows identity on the product path", async () => {
    const store = hubs();
    const pending = (await json(
      await api(store, "POST", "/api/views/request", {
        tenant: "buro-a",
        body: { purpose: "deneme", fields: ["account"] },
      }),
    )) as { request: { requestId: string } };
    const res = await api(store, "POST", "/api/agent/grant", {
      tenant: "buro-a",
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
