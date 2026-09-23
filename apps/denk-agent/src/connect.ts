import { mkdir } from "node:fs/promises";
import type { AgentResultMessage } from "../../../packages/consent-view/src/desk.ts";
import { pullKnowledge } from "./hub.ts";
import { localModelNote } from "./local-model.ts";
import { handleHubMessage, type AgentRuntime, type HubMessage } from "./session.ts";

export interface ConnectOptions {
  hubUrl: string;
  machineId: string;
  hostname: string;
  localDir: string;
}

export function agentSocketUrl(hubUrl: string): string {
  const url = new URL("/api/agent", hubUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export async function connectOnce(options: ConnectOptions): Promise<void> {
  await mkdir(options.localDir, { recursive: true });
  const runtime: AgentRuntime = {
    pack: await pullKnowledge(options.hubUrl),
    machineId: options.machineId,
    localDir: options.localDir,
  };
  const socket = new WebSocket(agentSocketUrl(options.hubUrl));
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let chain = Promise.resolve();
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error("Bağlantı koptu."));
    };
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "agent.hello", machineId: options.machineId, hostname: options.hostname }));
    });
    socket.addEventListener("message", (event) => {
      chain = chain.then(() => onMessage(runtime, String(event.data), (outbound) => socket.send(JSON.stringify(outbound)))).catch(fail);
    });
    socket.addEventListener("close", () => finish());
    socket.addEventListener("error", () => {
      if (socket.readyState === WebSocket.CONNECTING) fail(new Error("Merkeze bağlanılamadı."));
    });
  });
}

async function onMessage(
  runtime: AgentRuntime,
  raw: string,
  send: (outbound: AgentResultMessage) => void,
): Promise<void> {
  const message = JSON.parse(raw) as HubMessage;
  const next = await handleHubMessage(runtime, message, { narrate: localModelNote });
  runtime.pack = next.runtime.pack;
  runtime.localDir = next.runtime.localDir;
  runtime.machineId = next.runtime.machineId;
  if (next.outbound) send(next.outbound);
}

export async function connectLoop(options: ConnectOptions): Promise<void> {
  let delay = 1000;
  for (;;) {
    try {
      console.log(`${options.hostname} merkeze bağlanıyor. İş klasörü: ${options.localDir}`);
      await connectOnce(options);
      delay = 1000;
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 15000);
  }
}
