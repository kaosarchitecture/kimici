import { readFile } from "node:fs/promises";
import { DEFAULT_XAI_MODEL, runXaiChat, type ChatMessage } from "../../../packages/consent-view/src/ai.ts";
import type { KnowledgePack } from "../../../packages/consent-view/src/knowledge.ts";
import { defaultXaiEnvPath, parseXaiEnv } from "../../../packages/consent-view/src/xai-env.ts";

const PATH_SYSTEM = [
  "Bu Windows bilgisayarında çalışan DENK ajanısın.",
  "Sana yalnız bu makinede açılan SQL hedefleri ve bulunan kayıtlar verilir.",
  "Listede olmayan sunucu, şirket, fiş numarası veya tutar yazma.",
  "Kısa Türkçe söyle: SQL açıldı mı, şirket kodu ne, fiş okundu mu.",
].join(" ");

const ALLOWED = new Set(["SQL", "ETA", "WINDOWS", "XAI", "DENK"]);

export interface ModelCall {
  called: boolean;
  text: string | null;
}

/** The key stays in this PC's xai.env. The reply cannot add a voucher the SQL read did not return. */
export function acceptModelNote(reply: string, facts: string): string | null {
  const clean = reply.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (/deneme|password|parola|api[_-]?key|xai-[a-z0-9]|integrated security/i.test(clean)) return null;
  const factsUpper = facts.toLocaleUpperCase("tr-TR");
  const tokens = clean.match(/[A-Za-zÇĞİÖŞÜçğıöşü0-9]+(?:[-_][A-Za-z0-9]+)*/g) ?? [];
  for (const token of tokens) {
    const upper = token.toLocaleUpperCase("tr-TR");
    const looksLikeId = /\d/.test(token) || (upper === token && token.length >= 3);
    if (!looksLikeId || ALLOWED.has(upper)) continue;
    if (!factsUpper.includes(upper)) return null;
  }
  return clean.slice(0, 400);
}

export async function localModelNote(
  pack: KnowledgePack,
  facts: string,
  io: {
    readText?: () => Promise<string>;
    chat?: (key: string, messages: ChatMessage[], model: string) => Promise<string>;
    log?: (line: string) => void;
  } = {},
): Promise<ModelCall> {
  const log = io.log ?? (() => {});
  const creds = await localCreds(pack.modelHint, io.readText);
  if (!creds) {
    log("xAI anahtarı bu bilgisayarda yok. Okunan kayıt duruyor.");
    return { called: false, text: null };
  }
  log("xAI bu bilgisayarda açılıyor.");
  const messages: ChatMessage[] = [
    { role: "system", content: PATH_SYSTEM },
    { role: "user", content: facts },
  ];
  try {
    const chat = io.chat ?? runXaiChat;
    const text = await chat(creds.key, messages, creds.model);
    log("xAI cevap verdi.");
    return { called: true, text };
  } catch {
    log("xAI cevap vermedi.");
    return { called: true, text: null };
  }
}

async function localCreds(
  fallbackModel: string,
  readText?: () => Promise<string>,
): Promise<{ key: string; model: string } | null> {
  const envKey = process.env.XAI_API_KEY?.trim();
  if (envKey) return { key: envKey, model: process.env.XAI_MODEL?.trim() || fallbackModel || DEFAULT_XAI_MODEL };
  const read = readText ?? readDefaultEnv;
  try {
    const parsed = parseXaiEnv(await read());
    if (!parsed.apiKey) return null;
    return { key: parsed.apiKey, model: parsed.preferred || process.env.XAI_MODEL?.trim() || fallbackModel || DEFAULT_XAI_MODEL };
  } catch {
    return null;
  }
}

async function readDefaultEnv(): Promise<string> {
  const path = defaultXaiEnvPath();
  if (!path) throw new Error("xai.env yok.");
  return readFile(path, "utf8");
}
