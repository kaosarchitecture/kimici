import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";

export async function pullKnowledge(hubUrl: string): Promise<KnowledgePack> {
  const res = await fetch(new URL("/api/knowledge", hubUrl));
  if (!res.ok) throw new Error(`Bilgi paketi alınamadı: HTTP ${res.status}`);
  const body = (await res.json()) as { pack?: KnowledgePack };
  if (!body.pack?.vatDescription) throw new Error("Bilgi paketi bozuk.");
  return body.pack;
}
