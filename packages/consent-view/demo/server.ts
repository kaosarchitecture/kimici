import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChatMessages, extractModelText, WORKERS_AI_MODEL } from "../src/ai.ts";
import { documentFromFile, type UploadedDocument } from "../src/ubl.ts";

const MAX_EVRAK = 5 * 1024 * 1024;
let lastEvrak: UploadedDocument | null = null;

const uiRoot = fileURLToPath(new URL("../../../apps/admin-ui/dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8788);
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN ?? "";

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

async function runWorkersAi(messages: ReturnType<typeof buildChatMessages>): Promise<string> {
  if (!ACCOUNT || !TOKEN) {
    throw new Error(
      "Workers AI bağlı değil. denk-app Worker’ını Cloudflare’e yükleyin (wrangler deploy). Binding: env.AI → " +
        WORKERS_AI_MODEL +
        ". Yerel deneme için CLOUDFLARE_ACCOUNT_ID ve CLOUDFLARE_API_TOKEN ortam değişkeni gerekir; koda yazılmaz.",
    );
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/${WORKERS_AI_MODEL}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ messages }),
    },
  );
  const payload = (await res.json()) as { result?: unknown; errors?: Array<{ message?: string }> };
  if (!res.ok) {
    const hint = payload.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Workers AI cevap vermedi: ${hint}`);
  }
  const reply = extractModelText(payload.result ?? payload);
  if (!reply) throw new Error("Model boş cevap verdi.");
  return reply;
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
      return json(res, 200, {
        connected: Boolean(ACCOUNT && TOKEN),
        model: WORKERS_AI_MODEL,
        via: ACCOUNT && TOKEN ? "workers-ai-rest" : "disconnected",
        where: "denk-app Worker · Cloudflare Workers AI · müşteri makinesine gitmez",
      });
    }

    if (method === "POST" && url.pathname === "/api/ai") {
      const body = (await readBody(req)) as { message?: string; document?: UploadedDocument | null };
      const doc = body.document?.fileName ? body.document : lastEvrak;
      const reply = await runWorkersAi(buildChatMessages(body.message ?? "", doc));
      return json(res, 200, { reply, model: WORKERS_AI_MODEL, via: "workers-ai-rest" });
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DENK: http://0.0.0.0:${PORT}`);
  console.log(
    ACCOUNT && TOKEN
      ? `AI: Workers AI REST ${WORKERS_AI_MODEL}`
      : `AI bağlı değil — wrangler deploy ile denk-app + env.AI`,
  );
});
