import type { AgentResultMessage } from "../../../packages/consent-view/src/desk.ts";
import type { WindowsIdentity } from "../../../packages/consent-view/src/types.ts";
import { pullKnowledge } from "./hub.ts";
import { handleHubMessage, type AgentRuntime, type HubMessage } from "./session.ts";
import { WindowsAuthError } from "./windows-auth.ts";

export interface ConnectOptions {
  hubUrl: string;
  machineId: string;
  hostname: string;
  authorize: () => Promise<WindowsIdentity>;
}

export function agentSocketUrl(hubUrl: string): string {
  const url = new URL("/api/agent", hubUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export async function connectOnce(options: ConnectOptions): Promise<void> {
  const windows = await options.authorize();
  const runtime: AgentRuntime = {
    pack: await pullKnowledge(options.hubUrl),
    machineId: options.machineId,
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
      socket.send(
        JSON.stringify({
          type: "agent.hello",
          machineId: options.machineId,
          hostname: options.hostname,
          windows,
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      chain = chain
        .then(async () => {
          const parsed = JSON.parse(String(event.data)) as HubMessage;
          if (parsed.type === "error") throw new WindowsAuthError(parsed.error || "Windows onayı yok.");
          await onMessage(runtime, String(event.data), (outbound) => socket.send(JSON.stringify(outbound)));
        })
        .catch(fail);
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
  const next = await handleHubMessage(runtime, message);
  runtime.pack = next.runtime.pack;
  runtime.machineId = next.runtime.machineId;
  runtime.build = next.runtime.build;
  if (next.outbound) send(next.outbound);
}

export async function connectLoop(options: ConnectOptions): Promise<void> {
  let delay = 1000;
  for (;;) {
    try {
      console.log(`${options.hostname} merkeze bağlanıyor.`);
      await connectOnce(options);
      delay = 1000;
    } catch (error) {
      if (error instanceof WindowsAuthError) throw error;
      console.error(error instanceof Error ? error.message : error);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 15000);
  }
}
