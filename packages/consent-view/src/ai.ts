import type { UploadedDocument } from "./ubl.ts";
import { sortGrokNewest } from "./xai-env.ts";

/** Fallback if xai.env / secret has no working id. */
/** Live catalog for the DENK xai.env key (2026-09-23): only this chat model answered. */
export const DEFAULT_XAI_MODEL = "grok-4.20-0309-reasoning";

/** @deprecated use selected model from xai.env or XAI_MODEL env */
export const XAI_MODEL = DEFAULT_XAI_MODEL;

export function cfGrokId(model: string): string {
  return model.startsWith("xai/") ? model : `xai/${model}`;
}

export const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const SYSTEM_PROMPT = [
  "Sen DENK AI’sın. İşin evrak ve muhasebe fişi: oku, değerlendir, satırları kur, işle.",
  "Yüklenen evrakın çıkarılan alanlarını ve kurulan fiş satırlarını görürsün.",
  "Tutarı evraktan al; yoksa yok de, uydurma.",
  "Kanonik yazım: KDV açıklaması İND.KDV. (noktasız, boşluksuz). Nakit kapanış 100 01.",
  "Alış faturası: 770 borç (gider), 191 02 20 İND.KDV. borç, 320 alacak (N.FT İLE ALIŞ).",
  "Cevabında fişi değerlendir: hesap, B/A, tutar, açıklama, eksik veya tutarsız satır.",
  "Türkçe, somut, fiş dili. İşini yap.",
].join(" ");

export function documentContext(doc: UploadedDocument | null): string {
  if (!doc) return "Yüklü evrak yok. Kullanıcı evrak yükleyince fişi oku ve işle.";
  const header = [
    `dosya=${doc.fileName}`,
    `tür=${doc.kind}`,
    `evrakNo=${doc.invoiceNo || "yok"}`,
    `tarih=${doc.issueDate || "yok"}`,
    `tedarikçi=${doc.supplierName || "yok"}`,
    `matrah=${doc.netText || "yok"}`,
    `kdv=${doc.vatText || "yok"}`,
    `ödenecek=${doc.payableText || "yok"}`,
  ];
  const fis: string[] = [];
  if (doc.netText) fis.push(`1 B 770 01 ${doc.netText} ${doc.supplierName || doc.fileName}`);
  if (doc.vatText) fis.push(`2 B 191 02 20 ${doc.vatText} İND.KDV.`);
  if (doc.payableText) fis.push(`3 A 320 ${doc.payableText} N.FT İLE ALIŞ`);
  const body = `Yüklü evrak: ${header.join("; ")}`;
  return fis.length ? `${body}\nKurulan fiş:\n${fis.join("\n")}` : body;
}

export function buildChatMessages(userText: string, doc: UploadedDocument | null): ChatMessage[] {
  const asked = userText.trim() || "Bu evrakı oku. Fişi değerlendir ve işle.";
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `${documentContext(doc)}\n\nKullanıcı: ${asked}` },
  ];
}

export function xaiChatBody(messages: ChatMessage[], model = DEFAULT_XAI_MODEL): Record<string, unknown> {
  return { model, messages };
}

function textFromContent(content: unknown): string {
  if (typeof content === "string" && content.trim()) return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) return String((part as { text: unknown }).text ?? "");
      return "";
    })
    .join("")
    .trim();
}

export function extractModelText(result: unknown): string {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (!result || typeof result !== "object") return "";
  const row = result as Record<string, unknown>;
  if (Array.isArray(row.choices) && row.choices[0] && typeof row.choices[0] === "object") {
    const choice = row.choices[0] as Record<string, unknown>;
    const message = choice.message;
    if (message && typeof message === "object") {
      const fromMsg = textFromContent((message as { content?: unknown }).content);
      if (fromMsg) return fromMsg;
    }
    const fromText = textFromContent(choice.text);
    if (fromText) return fromText;
  }
  for (const key of ["response", "result", "output_text", "text"]) {
    if (typeof row[key] === "string" && String(row[key]).trim()) return String(row[key]).trim();
  }
  if (row.result && typeof row.result === "object") return extractModelText(row.result);
  return "";
}

export async function runXaiChat(
  apiKey: string,
  messages: ChatMessage[],
  model = DEFAULT_XAI_MODEL,
): Promise<string> {
  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(xaiChatBody(messages, model)),
    signal: AbortSignal.timeout(25_000),
  });
  const payload = (await res.json()) as { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(payload.error?.message ?? `xAI HTTP ${res.status}`);
  }
  const reply = extractModelText(payload);
  if (!reply) throw new Error(`${model} boş cevap verdi.`);
  return reply;
}

export async function listXaiModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.x.ai/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { data?: Array<{ id?: string }> };
  return (payload.data ?? []).map((row) => row.id ?? "").filter(Boolean);
}

export async function probeXaiModel(apiKey: string, model: string): Promise<boolean> {
  const res = await fetch(XAI_CHAT_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 8,
    }),
  });
  return res.ok;
}

export async function selectWorkingXaiModel(apiKey: string, candidates: string[]): Promise<string> {
  for (const model of sortGrokNewest(candidates)) {
    if (await probeXaiModel(apiKey, model)) return model;
  }
  throw new Error("xai.env / xAI hesabındaki Grok modellerinden çalışan bulunamadı.");
}
