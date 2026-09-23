import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildChatMessages,
  cfGrokId,
  DEFAULT_XAI_MODEL,
  extractModelText,
  listXaiModels,
  runXaiChat,
  selectWorkingXaiModel,
  type ChatMessage,
} from "../src/ai.ts";
import { defaultXaiEnvPath, parseXaiEnv } from "../src/xai-env.ts";
import { documentFromFile, type UploadedDocument } from "../src/ubl.ts";

const MAX_EVRAK = 5 * 1024 * 1024;
let lastEvrak: UploadedDocument | null = null;

const uiRoot = fileURLToPath(new URL("../../../apps/admin-ui/dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8788);
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";

const session = {
  key: "",
  model: DEFAULT_XAI_MODEL,
  via: "disconnected",
  source: "",
};

async function bootXai(): Promise<void> {
  const path = defaultXaiEnvPath();
  const keys: string[] = [];
  let fromFile: string[] = [];
  if (process.env.XAI_API_KEY) keys.push(process.env.XAI_API_KEY);
  if (path) {
    try {
      const parsed = parseXaiEnv(await readFile(path, "utf8"));
      keys.push(...parsed.apiKeys);
      fromFile = parsed.preferred ? [parsed.preferred, ...parsed.models] : parsed.models;
      session.source = path;
    } catch {
      session.source = "";
    }
  }
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  for (const key of uniqueKeys) {
    const apiList = await listXaiModels(key);
    const candidates = fromFile.length > 0 ? fromFile : apiList;
    if (candidates.length === 0) continue;
    try {
      session.model = await selectWorkingXaiModel(key, candidates);
    } catch {
      if (fromFile.length && apiList.length) {
        session.model = await selectWorkingXaiModel(key, apiList);
      } else {
        continue;
      }
    }
    session.key = key;
    session.via = "xai-rest";
    return;
  }
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function cors(res: ServerResponse): void {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function runGrok(messages: ChatMessage[]): Promise<{ reply: string; via: string }> {
  if (session.key) {
    return { reply: await runXaiChat(session.key, messages, session.model), via: session.via };
  }
  if (ACCOUNT && TOKEN) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: cfGrokId(session.model), messages }),
      },
    );
    const payload = (await res.json()) as { result?: unknown; errors?: Array<{ message?: string }> };
    if (!res.ok) {
      throw new Error(payload.errors?.[0]?.message ?? `Cloudflare AI HTTP ${res.status}`);
    }
    const reply = extractModelText(payload.result ?? payload);
    if (!reply) throw new Error(`${session.model} boş cevap verdi.`);
    return { reply, via: "ai-gateway" };
  }
  throw new Error(
    "Grok bağlı değil. Windows’ta C:\\DENK\\secrets\\xai.env okunur; bu Linux ortamında XAI_ENV_FILE veya wrangler secret gerekir. Anahtar koda yazılmaz.",
  );
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const method = req.method ?? "GET";
    cors(res);

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === "GET" && url.pathname === "/api/ai") {
      const connected = Boolean(session.key || (ACCOUNT && TOKEN));
      return json(res, 200, {
        connected,
        model: session.model,
        via: session.key ? session.via : ACCOUNT && TOKEN ? "ai-gateway" : "disconnected",
        where: "Grok · xai.env veya Worker secret · müşteri makinesine gitmez",
        source: session.source || undefined,
      });
    }

    if (method === "POST" && url.pathname === "/api/ai") {
      const body = (await readBody(req)) as { message?: string; document?: UploadedDocument | null };
      const doc = body.document?.fileName ? body.document : lastEvrak;
      const { reply, via } = await runGrok(buildChatMessages(body.message ?? "", doc));
      return json(res, 200, { reply, model: session.model, via });
    }

    if (method === "GET" && url.pathname === "/api/evrak") {
      return json(res, 200, { document: lastEvrak });
    }

    if (method === "POST" && url.pathname === "/api/evrak") {
      const body = (await readBody(req)) as {
        fileName?: string;
        mime?: string;
        contentBase64?: string;
      };
      const fileName = (body.fileName ?? "evrak").slice(0, 200);
      const mime = body.mime ?? "application/octet-stream";
      const buf = Buffer.from(body.contentBase64 ?? "", "base64");
      if (buf.length === 0) return json(res, 400, { error: "Dosya boş." });
      if (buf.length > MAX_EVRAK) return json(res, 400, { error: "Dosya 5 MB üstü olamaz." });
      lastEvrak = documentFromFile(fileName, mime, buf.length, buf.toString("utf8"));
      return json(res, 200, { document: lastEvrak });
    }

    if (method === "GET") {
      const relative = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = join(uiRoot, relative);
      if (!filePath.startsWith(uiRoot)) return json(res, 403, { error: "forbidden" });
      try {
        const data = await readFile(filePath);
        res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
        res.end(data);
        return;
      } catch {
        const fallback = await readFile(join(uiRoot, "index.html"));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(fallback);
        return;
      }
    }

    json(res, 404, { error: "bulunamadı" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hata";
    const status = message.includes("bağlı değil") ? 503 : 400;
    json(res, status, { error: message });
  }
});

await bootXai();
server.listen(PORT, "0.0.0.0", () => {
  console.log(`DENK: http://0.0.0.0:${PORT}`);
  console.log(
    session.key || (ACCOUNT && TOKEN)
      ? `AI: ${session.model} (${session.via}${session.source ? ` · ${session.source}` : ""})`
      : "Grok bağlı değil — C:\\DENK\\secrets\\xai.env veya XAI_ENV_FILE",
  );
});
