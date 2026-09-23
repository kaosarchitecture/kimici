import type { HubSnapshot, ViewField } from "./types.ts";

async function readJson(res: Response): Promise<HubSnapshot> {
  const body = (await res.json()) as HubSnapshot & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "İstek başarısız.");
  return body;
}

export async function fetchState(): Promise<HubSnapshot> {
  const res = await fetch("/api/state");
  return readJson(res);
}

export async function requestView(purpose: string, fields: ViewField[]): Promise<HubSnapshot> {
  const res = await fetch("/api/ai/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose, fields }),
  });
  return readJson(res);
}

export async function grantView(fields: ViewField[]): Promise<HubSnapshot> {
  const res = await fetch("/api/agent/grant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return readJson(res);
}

export async function denyView(): Promise<HubSnapshot> {
  const res = await fetch("/api/agent/deny", { method: "POST" });
  return readJson(res);
}

export async function revokeView(): Promise<HubSnapshot> {
  const res = await fetch("/api/revoke", { method: "POST" });
  return readJson(res);
}

export function subscribeState(onState: (state: HubSnapshot) => void): () => void {
  const source = new EventSource("/api/events");
  source.onmessage = (event) => {
    onState(JSON.parse(event.data) as HubSnapshot);
  };
  return () => source.close();
}
