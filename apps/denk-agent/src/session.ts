import type { AgentResultMessage } from "../../../packages/consent-view/src/desk.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { runInbox, type InboxResult } from "./inbox.ts";

export interface AgentRuntime {
  pack: KnowledgePack | null;
  machineId: string;
  localDir: string;
}

export interface HubMessage {
  type?: string;
  pack?: KnowledgePack;
  jobId?: string;
  error?: string;
}

export async function handleHubMessage(
  runtime: AgentRuntime,
  message: HubMessage,
  io: {
    runInbox?: (localDir: string, pack: KnowledgePack) => Promise<InboxResult>;
    narrate?: (pack: KnowledgePack, preview: string) => Promise<string | null>;
  } = {},
): Promise<{ runtime: AgentRuntime; outbound: AgentResultMessage | null }> {
  if (message.type === "rules" && message.pack?.version) {
    return { runtime: { ...runtime, pack: message.pack }, outbound: null };
  }
  if (message.type !== "job.run" || !message.jobId) {
    return { runtime, outbound: null };
  }
  if (!runtime.pack) {
    return {
      runtime,
      outbound: {
        type: "agent.result",
        jobId: message.jobId,
        machineId: runtime.machineId,
        status: "failed",
        note: "Kural paketi bu bağlantıda yok.",
        vouchers: [],
      },
    };
  }

  const work = io.runInbox ?? runInbox;
  let result: InboxResult;
  try {
    result = await work(runtime.localDir, runtime.pack);
  } catch (error) {
    const note = error instanceof Error ? error.message : "Bu bilgisayarda işlem durdu.";
    return {
      runtime,
      outbound: {
        type: "agent.result",
        jobId: message.jobId,
        machineId: runtime.machineId,
        status: "failed",
        note,
        vouchers: [],
      },
    };
  }

  const outbound: AgentResultMessage = {
    type: "agent.result",
    jobId: message.jobId,
    machineId: runtime.machineId,
    status: result.status,
    note: result.note,
    vouchers: result.vouchers,
  };
  if (io.narrate && result.vouchers.length > 0) {
    const preview = result.vouchers.map((row) => row.preview).join("\n\n").slice(0, 6000);
    const modelNote = await io.narrate(runtime.pack, preview);
    if (modelNote?.trim()) outbound.modelNote = modelNote.trim();
  }
  return { runtime, outbound };
}
