import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConsentHub } from "../src/hub.ts";
import { CORS, isControlPlanePath, routeControlPlane } from "../src/http.ts";
import { TenantBook } from "../src/registry.ts";

const uiRoot = fileURLToPath(new URL("../../../apps/admin-ui/dist", import.meta.url));
const PORT = Number(process.env.PORT ?? 8788);
const hubs = new Map<string, ConsentHub>();
const book = new TenantBook();

function hubFor(tenant: string): ConsentHub {
  const existing = hubs.get(tenant);
  if (existing) return existing;
  const hub = new ConsentHub();
  hubs.set(tenant, hub);
  return hub;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function applyCors(res: ServerResponse): void {
  for (const [key, value] of Object.entries(CORS)) res.setHeader(key, value);
}

function json(res: ServerResponse, status: number, body: unknown): void {
  applyCors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function toFetchRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const method = req.method ?? "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return new Request(url, { method, headers, body: Buffer.concat(chunks) });
}

async function writeFetchResponse(res: ServerResponse, response: Response): Promise<void> {
  applyCors(res);
  response.headers.forEach((value, key) => {
    if (key === "content-length") return;
    res.setHeader(key, value);
  });
  res.writeHead(response.status);
  if (response.status === 204 || !response.body) {
    res.end();
    return;
  }
  res.end(Buffer.from(await response.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const method = req.method ?? "GET";
    applyCors(res);

    if (isControlPlanePath(url.pathname) || (method === "OPTIONS" && url.pathname.startsWith("/api/"))) {
      const request = await toFetchRequest(req, url);
      const response = await routeControlPlane(request, {
        book,
        resolveHub: async (tenant) => hubFor(tenant),
      });
      if (response) {
        await writeFetchResponse(res, response);
        return;
      }
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
    json(res, 400, { error: message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`DENK: http://0.0.0.0:${PORT}`);
  console.log("Evrak yok · büro kaydı + cihaz anahtarı");
});
