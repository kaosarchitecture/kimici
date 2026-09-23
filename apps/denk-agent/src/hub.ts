import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import type { HubSnapshot, ViewRecord, WindowsIdentity } from "../../../packages/consent-view/src/types.ts";

export async function pullKnowledge(hubUrl: string): Promise<KnowledgePack> {
  const res = await fetch(new URL("/api/knowledge", hubUrl));
  if (!res.ok) throw new Error(`Bilgi paketi alınamadı: HTTP ${res.status}`);
  const body = (await res.json()) as { pack?: KnowledgePack };
  if (!body.pack?.vatDescription) throw new Error("Bilgi paketi bozuk.");
  return body.pack;
}

export async function enrollDevice(
  hubUrl: string,
  enrollCode: string,
): Promise<{ tenant: string; deviceKey: string }> {
  const res = await fetch(new URL("/api/enroll", hubUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enrollCode }),
  });
  const body = (await res.json()) as { tenant?: string; deviceKey?: string; error?: string };
  if (!res.ok || !body.tenant || !body.deviceKey) throw new Error(body.error ?? "Kayıt olmadı.");
  return { tenant: body.tenant, deviceKey: body.deviceKey };
}

async function hubJson<T>(
  hubUrl: string,
  tenant: string,
  deviceKey: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, hubUrl);
  if (!init?.method || init.method === "GET") url.searchParams.set("tenant", tenant);
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      "X-Denk-Tenant": tenant,
      "X-Denk-Device": deviceKey,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export async function readHubState(
  hubUrl: string,
  tenant: string,
  deviceKey: string,
): Promise<HubSnapshot & { tenant: string }> {
  return hubJson(hubUrl, tenant, deviceKey, "/api/state");
}

export async function syncPermittedView(input: {
  hubUrl: string;
  tenant: string;
  deviceKey: string;
  identity: WindowsIdentity;
  records: readonly ViewRecord[];
}): Promise<"pushed" | "no-request"> {
  const state = await readHubState(input.hubUrl, input.tenant, input.deviceKey);
  if ((state.status !== "pending" && state.status !== "prompted") || !state.request) {
    return "no-request";
  }
  const requestId = state.request.requestId;
  await hubJson(input.hubUrl, input.tenant, input.deviceKey, "/api/agent/prompted", {
    method: "POST",
    body: JSON.stringify({ requestId, identity: input.identity }),
  });
  const granted = await hubJson<HubSnapshot>(input.hubUrl, input.tenant, input.deviceKey, "/api/agent/grant", {
    method: "POST",
    body: JSON.stringify({ requestId, identity: input.identity }),
  });
  if (!granted.grant) throw new Error("Windows onayı kaydedilemedi.");
  await hubJson(input.hubUrl, input.tenant, input.deviceKey, "/api/agent/push", {
    method: "POST",
    body: JSON.stringify({ grantId: granted.grant.grantId, records: input.records }),
  });
  return "pushed";
}
