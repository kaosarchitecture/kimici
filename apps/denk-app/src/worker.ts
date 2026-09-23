import { DurableObject } from "cloudflare:workers";
import {
  buildChatMessages,
  cfGrokId,
  DEFAULT_XAI_MODEL,
  extractModelText,
  runXaiChat,
} from "../../../packages/consent-view/src/ai.ts";
import { documentFromFile, type UploadedDocument } from "../../../packages/consent-view/src/ubl.ts";

export interface Env {
  ASSETS: Fetcher;
  EVRAK: DurableObjectNamespace<EvrakStore>;
  AI: Ai;
  XAI_API_KEY?: string;
  XAI_MODEL?: string;
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

function modelOf(env: Env): string {
  return env.XAI_MODEL || DEFAULT_XAI_MODEL;
}

async function runGrok(env: Env, messages: ReturnType<typeof buildChatMessages>): Promise<{ reply: string; via: string }> {
  const model = modelOf(env);
  if (env.XAI_API_KEY) {
    return { reply: await runXaiChat(env.XAI_API_KEY, messages, model), via: "xai-rest" };
  }
  const run = env.AI.run.bind(env.AI) as (
    model: string,
    input: { messages: typeof messages },
    opts?: { gateway: { id: string } },
  ) => Promise<unknown>;
  const raw = await run(cfGrokId(model), { messages }, { gateway: { id: "default" } });
  const reply = extractModelText(raw);
  if (!reply) throw new Error(`${model} boş cevap verdi.`);
  return { reply, via: "ai-gateway" };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/ai") {
      if (request.method === "GET") {
        return json({
          connected: true,
          model: modelOf(env),
          via: env.XAI_API_KEY ? "xai-rest" : "ai-gateway",
          where: "denk-app Worker · Grok · müşteri makinesine gitmez",
        });
      }
      if (request.method !== "POST") return json({ error: "izin yok" }, 405);
      const body = (await request.json()) as { message?: string; document?: UploadedDocument | null };
      const store = env.EVRAK.getByName("last");
      const doc = await storedOrBody(store, body.document);
      try {
        const { reply, via } = await runGrok(env, buildChatMessages(body.message ?? "", doc));
        return json({ reply, model: modelOf(env), via });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Grok cevap vermedi.";
        return json({ error: message, model: modelOf(env) }, 502);
      }
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
