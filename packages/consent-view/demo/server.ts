import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConsentHub } from "../src/hub.ts";
import { demoWindowsIdentity } from "../src/windows.ts";
import { VIEW_FIELDS, type ViewField } from "../src/types.ts";
import { LOCAL_MACHINE_RECORDS } from "./fixture.ts";

const root = fileURLToPath(new URL("./public", import.meta.url));
const hub = new ConsentHub();
const clients = new Set<ServerResponse>();
const PORT = Number(process.env.PORT ?? 8788);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function broadcast(): void {
  const payload = `data: ${JSON.stringify(hub.snapshot())}\n\n`;
  for (const client of clients) client.write(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function asFields(value: unknown): ViewField[] {
  if (!Array.isArray(value)) return [...VIEW_FIELDS];
  return value.filter((item): item is ViewField =>
    (VIEW_FIELDS as readonly string[]).includes(String(item)),
  );
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
    const method = req.method ?? "GET";

    if (method === "GET" && url.pathname === "/api/state") {
      return json(res, 200, hub.snapshot());
    }

    if (method === "GET" && url.pathname === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify(hub.snapshot())}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (method === "POST" && url.pathname === "/api/ai/request") {
      const body = (await readBody(req)) as { purpose?: string; fields?: string[] };
      const request = hub.requestView({
        purpose: body.purpose ?? "Ağustos alış faturası önizlemesi",
        fields: asFields(body.fields),
      });
      hub.markPrompted(request.requestId, demoWindowsIdentity());
      broadcast();
      return json(res, 200, hub.snapshot());
    }

    if (method === "POST" && url.pathname === "/api/agent/grant") {
      const body = (await readBody(req)) as { fields?: string[] };
      const snap = hub.snapshot();
      if (!snap.request) return json(res, 400, { error: "Bekleyen izin isteği yok." });
      const grant = hub.grant(snap.request.requestId, {
        identity: demoWindowsIdentity(),
        fields: asFields(body.fields ?? snap.request.fields),
      });
      hub.pushView(grant.grantId, LOCAL_MACHINE_RECORDS);
      broadcast();
      return json(res, 200, hub.snapshot());
    }

    if (method === "POST" && url.pathname === "/api/agent/deny") {
      const snap = hub.snapshot();
      if (!snap.request) return json(res, 400, { error: "Bekleyen izin isteği yok." });
      hub.deny(snap.request.requestId, "Kullanıcı Windows onayını reddetti.");
      broadcast();
      return json(res, 200, hub.snapshot());
    }

    if (method === "POST" && url.pathname === "/api/revoke") {
      const snap = hub.snapshot();
      if (!snap.grant) return json(res, 400, { error: "Geri alınacak onay yok." });
      hub.revoke(snap.grant.grantId);
      broadcast();
      return json(res, 200, hub.snapshot());
    }

    const filePath = url.pathname === "/" ? join(root, "index.html") : join(root, url.pathname);
    if (!filePath.startsWith(root)) return json(res, 403, { error: "forbidden" });
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hata";
    json(res, 400, { error: message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`DENK izinli görünüm: http://127.0.0.1:${PORT}`);
});
