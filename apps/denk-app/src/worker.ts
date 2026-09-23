import { DurableObject } from "cloudflare:workers";
import { buildKnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import {
  emptyDesk,
  onDisconnect,
  onHello,
  onResult,
  onRun,
  publicSnapshot,
  type AgentHello,
  type AgentResultMessage,
  type DeskSnapshot,
  type DeskState,
  type HubToAgent,
  type JobRecord,
  type OnlineMachine,
} from "../../../packages/consent-view/src/desk.ts";

export interface Env {
  ASSETS: Fetcher;
  DESK: DurableObjectNamespace<MachineHub>;
}

const STATE_KEY = "desk";

interface SocketMeta {
  role: "agent" | "ui";
  machineId?: string;
  hostname?: string;
  connectedAt?: string;
  windowsAccount?: string;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function metaOf(ws: WebSocket): SocketMeta | null {
  const value = ws.deserializeAttachment();
  if (!value || typeof value !== "object") return null;
  return value as SocketMeta;
}

export class MachineHub extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      const role = url.pathname === "/api/agent" ? "agent" : "ui";
      server.serializeAttachment({ role } satisfies SocketMeta);
      if (role === "ui") server.send(JSON.stringify(await this.view()));
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/api/machines" && request.method === "GET") {
      return json(await this.view());
    }

    const run = /^\/api\/machines\/([^/]+)\/run$/.exec(url.pathname);
    if (run && request.method === "POST") {
      const machineId = decodeURIComponent(run[1] ?? "");
      try {
        const job = await this.startRun(machineId);
        return json({ jobId: job.jobId, machineId: job.machineId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "İşlem başlatılamadı.";
        const status = message.includes("bağlı değil") ? 409 : 400;
        return json({ error: message }, status);
      }
    }

    return json({ error: "izin yok" }, 405);
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (metaOf(ws)?.role !== "agent") return;
    let message: { type?: string; machineId?: string; hostname?: string };
    try {
      message = JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)) as {
        type?: string;
        machineId?: string;
        hostname?: string;
        windows?: AgentHello["windows"];
      };
    } catch {
      return;
    }

    if (message.type === "agent.hello") {
      const machineId = message.machineId?.trim() ?? "";
      const hostname = message.hostname?.trim() || machineId;
      try {
        const pack = buildKnowledgePack();
        const outcome = await this.commit((state) =>
          onHello(
            state,
            { type: "agent.hello", machineId, hostname, windows: message.windows as AgentHello["windows"] },
            new Date(),
            pack,
          ),
        );
        ws.serializeAttachment({
          role: "agent",
          machineId,
          hostname,
          connectedAt: new Date().toISOString(),
          windowsAccount: outcome.job.windowsAccount,
        } satisfies SocketMeta);
        this.closeOtherAgents(machineId, ws);
        this.sendAll(ws, outcome.toAgent);
        this.broadcast(await this.view());
      } catch (error) {
        const text = error instanceof Error ? error.message : "Windows onayı yok.";
        ws.send(JSON.stringify({ type: "error", error: text }));
        ws.close(4001, "windows");
      }
      return;
    }

    if (message.type === "agent.result") {
      const attached = metaOf(ws);
      if (!attached?.machineId || !attached.windowsAccount) {
        ws.close(4001, "windows");
        return;
      }
      const result = message as AgentResultMessage;
      try {
        await this.commit((state) => ({
          state: onResult(state, { ...result, machineId: attached.machineId as string }, new Date()),
        }));
        this.broadcast(await this.view());
      } catch {
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropIfGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropIfGone(ws);
  }

  private async dropIfGone(ws: WebSocket): Promise<void> {
    const attached = metaOf(ws);
    if (attached?.role !== "agent" || !attached.machineId) {
      this.broadcast(await this.view());
      return;
    }
    if (this.agentSocket(attached.machineId)) return;
    await this.commit((state) => ({ state: onDisconnect(state, attached.machineId as string, new Date()) }));
    this.broadcast(await this.view());
  }

  private async startRun(machineId: string): Promise<JobRecord> {
    const socket = this.agentSocket(machineId);
    if (!socket) throw new Error("Bu bilgisayar bağlı değil.");
    const attached = metaOf(socket);
    const outcome = await this.commit((state) =>
      onRun(state, machineId, attached?.hostname || machineId, true, new Date()),
    );
    socket.send(JSON.stringify({ type: "job.run", jobId: outcome.job.jobId }));
    this.broadcast(await this.view());
    return outcome.job;
  }

  private sendAll(ws: WebSocket, messages: readonly HubToAgent[]): void {
    for (const outbound of messages) ws.send(JSON.stringify(outbound));
  }

  private agentSocket(machineId: string): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const attached = metaOf(ws);
      if (attached?.role === "agent" && attached.machineId === machineId && attached.windowsAccount) return ws;
    }
    return null;
  }

  private closeOtherAgents(machineId: string, current: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === current) continue;
      const attached = metaOf(ws);
      if (attached?.role === "agent" && attached.machineId === machineId) ws.close(4000, "yerine yeni bağlantı");
    }
  }

  private online(): OnlineMachine[] {
    const rows: OnlineMachine[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attached = metaOf(ws);
      if (attached?.role === "agent" && attached.machineId && attached.windowsAccount) {
        rows.push({
          machineId: attached.machineId,
          hostname: attached.hostname || attached.machineId,
          connectedAt: attached.connectedAt || new Date().toISOString(),
        });
      }
    }
    return rows;
  }

  private async view(): Promise<DeskSnapshot> {
    const state = await this.dropWithoutWindows();
    return publicSnapshot(state, this.online(), buildKnowledgePack());
  }

  private async dropWithoutWindows(): Promise<DeskState> {
    const state = (await this.ctx.storage.get<DeskState>(STATE_KEY)) ?? emptyDesk();
    const jobs = Object.fromEntries(Object.entries(state.jobs).filter(([, job]) => Boolean(job.windowsAccount)));
    const lastByMachine = Object.fromEntries(
      Object.entries(state.lastByMachine).filter(([, jobId]) => Boolean(jobs[jobId])),
    );
    if (Object.keys(jobs).length === Object.keys(state.jobs).length) return state;
    const cleaned = { jobs, lastByMachine };
    await this.ctx.storage.put(STATE_KEY, cleaned);
    return cleaned;
  }

  private broadcast(snapshot: DeskSnapshot): void {
    const text = JSON.stringify(snapshot);
    for (const ws of this.ctx.getWebSockets()) {
      if (metaOf(ws)?.role !== "ui") continue;
      try {
        ws.send(text);
      } catch {
        // The UI socket may already be closing.
      }
    }
  }

  private commit<T extends { state: DeskState }>(change: (state: DeskState) => T): Promise<T> {
    return this.ctx.blockConcurrencyWhile(async () => {
      const current = (await this.ctx.storage.get<DeskState>(STATE_KEY)) ?? emptyDesk();
      const next = change(current);
      await this.ctx.storage.put(STATE_KEY, next.state);
      return next;
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/knowledge") {
      if (request.method !== "GET") return json({ error: "izin yok" }, 405);
      return json({ pack: buildKnowledgePack(), where: "kural paketi · müşteri defteri yok" });
    }

    if (url.pathname === "/api/ai" || url.pathname === "/api/evrak") {
      return json({ error: "Evrak bu sunucuya alınmaz. İşlem, bağlanan bilgisayarda yapılır." }, 410);
    }

    if (
      url.pathname === "/api/agent" ||
      url.pathname === "/api/desk" ||
      url.pathname === "/api/machines" ||
      url.pathname.startsWith("/api/machines/")
    ) {
      return env.DESK.getByName("live").fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
