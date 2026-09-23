import { readFile } from "node:fs/promises";
import { runXaiChat, type ChatMessage } from "../../../packages/consent-view/src/ai.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { defaultXaiEnvPath, parseXaiEnv } from "../../../packages/consent-view/src/xai-env.ts";

/** Model call stays on this computer. Missing key means the rule engine result stands alone. */
export async function localModelNote(pack: KnowledgePack, preview: string): Promise<string | null> {
  const creds = await localCreds(pack.modelHint);
  if (!creds) return null;
  const messages: ChatMessage[] = [
    { role: "system", content: pack.prompt },
    {
      role: "user",
      content: `Bu fiş bu bilgisayarda, buluttaki kural paketi ${pack.version} ile kuruldu. Tutarları değiştirme. Değerlendir:\n${preview}`,
    },
  ];
  try {
    return await runXaiChat(creds.key, messages, creds.model);
  } catch {
    return null;
  }
}

async function localCreds(fallbackModel: string): Promise<{ key: string; model: string } | null> {
  const envKey = process.env.XAI_API_KEY?.trim();
  if (envKey) return { key: envKey, model: process.env.XAI_MODEL?.trim() || fallbackModel };
  const path = defaultXaiEnvPath();
  if (!path) return null;
  try {
    const parsed = parseXaiEnv(await readFile(path, "utf8"));
    if (!parsed.apiKey) return null;
    return { key: parsed.apiKey, model: parsed.preferred || process.env.XAI_MODEL?.trim() || fallbackModel };
  } catch {
    return null;
  }
}
