import { DurableObject } from "cloudflare:workers";
import { buildChatMessages, extractModelText, WORKERS_AI_MODEL } from "../../../packages/consent-view/src/ai.ts";
import { documentFromFile, type UploadedDocument } from "../../../packages/consent-view/src/ubl.ts";

export interface Env {
  ASSETS: Fetcher;
  EVRAK: DurableObjectNamespace<EvrakStore>;
  AI: Ai;
}

const MAX = 5 * 1024 * 1024;

export class EvrakStore extends DurableObject<Env> {
  async getDoc(): Promise<UploadedDocument | null> {
    return (await this.ctx.storage.get<UploadedDocument>("doc")) ?? null;
  }

  async putDoc(doc: UploadedDocument): Promise<UploadedDocument> {
    await this.ctx.storage.put("doc", doc);
    return doc;
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function decodeBase64(raw: string): Uint8Array {
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function storedOrBody(
  store: DurableObjectStub<EvrakStore>,
  bodyDoc: UploadedDocument | null | undefined,
): Promise<UploadedDocument | null> {
  if (bodyDoc && bodyDoc.fileName) return bodyDoc;
  return store.getDoc();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai") {
      if (request.method === "GET") {
        return json({
          connected: true,
          model: WORKERS_AI_MODEL,
          via: "workers-ai-binding",
          where: "denk-app Worker · Cloudflare Workers AI · müşteri makinesine gitmez",
        });
      }
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      const body = (await request.json()) as { message?: string; document?: UploadedDocument | null };
      const store = env.EVRAK.getByName("last");
      const doc = await storedOrBody(store, body.document);
      const messages = buildChatMessages(body.message ?? "", doc);
      const raw = await env.AI.run(WORKERS_AI_MODEL, { messages });
      const reply = extractModelText(raw);
      if (!reply) return json({ error: "Model boş cevap verdi.", model: WORKERS_AI_MODEL }, 502);
      return json({ reply, model: WORKERS_AI_MODEL, via: "workers-ai-binding" });
    }

    if (url.pathname === "/api/evrak") {
      const store = env.EVRAK.getByName("last");
      if (request.method === "GET") {
        return json({ document: await store.getDoc() });
      }
      if (request.method === "POST") {
        const body = (await request.json()) as {
          fileName?: string;
          mime?: string;
          contentBase64?: string;
        };
        const bytes = decodeBase64(body.contentBase64 ?? "");
        if (bytes.byteLength === 0) return json({ error: "Dosya boş." }, 400);
        if (bytes.byteLength > MAX) return json({ error: "Dosya 5 MB üstü olamaz." }, 400);
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
        const doc = documentFromFile(
          (body.fileName ?? "evrak").slice(0, 200),
          body.mime ?? "application/octet-stream",
          bytes.byteLength,
          text,
        );
        return json({ document: await store.putDoc(doc) });
      }
      return json({ error: "izin yok" }, 405);
    }

    return env.ASSETS.fetch(request);
  },
};
